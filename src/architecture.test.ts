import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(path.join(directory, entry.name)) : Promise.resolve([path.join(directory, entry.name)])))).flat();
}

it("keeps landing, backend, workspace, and shared runtime dependencies separate", async () => {
  const root = path.resolve("src");
  const violations: string[] = [];
  for (const file of await sourceFiles(root)) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const owner = path.relative(root, file).split(path.sep)[0];
    if (!["landing", "backend", "workspace", "shared"].includes(owner)) continue;
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
    function check(specifier: string, typeOnly: boolean) {
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return;
      const resolved = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      const target = path.relative(root, resolved).split(path.sep)[0];
      if (target === owner || target === "shared") return;
      // Hono's RPC contract is the only cross-domain backend import in the UI.
      if (owner === "workspace" && target === "backend" && typeOnly && resolved === path.join(root, "backend", "api")) return;
      violations.push(`${path.relative(root, file)} imports ${specifier}${typeOnly ? " (type)" : " (runtime)"}`);
    }
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const typeOnly = Boolean(clause?.isTypeOnly || (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every((binding) => binding.isTypeOnly)));
        check(node.moduleSpecifier.text, typeOnly);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        check(node.moduleSpecifier.text, node.isTypeOnly);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) {
        check(node.arguments[0].text, false);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations).toEqual([]);
});
