# Portfi UI design direction

The objective is a portfolio builder people can trust and use without learning design software. Visual quality should make the output desirable; the editor should make getting there straightforward.

## Recommended visual system

- Keep warm ivory `#F7F6F2`, deep ink `#151821`, and cobalt `#2447E8` as the Portfi identity. Concentrate cobalt on actions, active selection, and focus. Let user portfolios have independent palettes.
- Use Manrope for readable UI and Instrument Serif for a few expressive marketing words. Maintain a deliberate type scale, comfortable line lengths, and visible hierarchy. Small miniature portfolio text is illustrative; real controls must remain readable.
- Use an 8px spacing rhythm, with 4px adjustments for dense editor controls. Maintain shared semantic tokens for surfaces, borders, focus, errors, selected states, and motion.
- Keep the landing page editorial and expressive: asymmetric hero, credible product demo, varied template output, simple ownership story, and honest launch-plan descriptions.
- Keep the workspace calm: stable left controls, a large preview, one clear primary action, descriptive labels, and predictable selection. Expose content first; put layout, responsive overrides, and advanced motion behind clearly named controls.

## Smooth edges and motion

Use alpha borders, local edge fades, softly layered shadows, and clipped rounded images to blend surfaces. A small translucent header can help; widespread glass layers make editing harder. Keep text and icons sharp. Do not blur the whole page or force every layer onto the GPU. Review rotated image edges on actual browser/display combinations; rendering cannot be guaranteed identical everywhere.

Give each animation a job: introduce hierarchy, connect an edit to its result, show state changes, or demonstrate a portfolio preset. Use once-per-view entrances and short stagger intervals. Retain native scrolling. Avoid mandatory intro sequences and continuous movement competing with content.

The landing implementation uses lazy Motion features, transform/opacity entrances, small CSS interactions, and a persisted motion toggle. FAQ height animation is limited to the open/close interaction. Device reduced-motion preferences take priority. See [Motion's reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion) and [web.dev's animation performance guidance](https://web.dev/articles/animations-guide).

## Design the important states

For every editor control, design default, hover, focus, selected, disabled, invalid, saving, saved, and failed states where applicable. Show a clear saving status and an actionable recovery path. Destructive portfolio/page actions need an understandable consequence and a recovery model. Templates should handle a first-time user's empty document as carefully as the polished sample.

Make mobile editing a deliberate layout: switch between Edit and Preview, keep the current section clear, and make reordering possible without dragging. Use larger touch targets for primary controls, aiming for 44px where practical; WCAG 2.2 AA's target-size criterion has a 24px minimum with defined exceptions. Do not confuse that minimum with the product's preferred touch size. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## If hiring a UI designer

Look for a product designer with shipped SaaS tools, visual editors, or complex forms, plus strong typography and motion work. A portfolio of attractive landing screenshots alone does not prove they can simplify this editor.

Ask to see:

1. A responsive shipped product and an explanation of the user's main task.
2. Reusable components with variants/tokens and loading/error/empty states.
3. A complex workflow they made understandable, with usability evidence.
4. Accessible keyboard, focus, and reduced-motion decisions.
5. Developer handoff that includes interaction behavior and content constraints.

A useful trial assignment is one complete interaction: adding a project, changing its layout, previewing mobile, and recovering a failed save. Evaluate clarity, consistency, and implementation practicality alongside appearance. Request an editable component system and a working prototype, not just isolated mockups.

## Practical next design work

Prioritize three deliverables: a compact Portfi component/token library, a complete create-to-publish flow, and a motion/state specification. Use a component-based design/prototyping tool that the team already works in; the maintained source components remain the implementation reference.

Run short task-based sessions with people who do not code: create a two-page portfolio, add two projects, change a style, recover a mistake, and publish. Track where they hesitate and whether they can finish without instructions. Improve those points before adding more controls.

## Review before launch

- Compare rendered 360px, 768px, and desktop layouts, plus zoom and continuous resizing. Check overflow, line breaks, cropping, focus visibility, sticky-header anchors, and touch controls.
- Test keyboard navigation, screen-reader names/state, high contrast, reduced motion, paused motion, long names, empty projects, and slow/failed saves.
- Measure loading, responsiveness, layout stability, and animation frame cost. Preserve a usable server-rendered page before optional motion loads.
- Compare exported portfolios with editor previews and test real device drag/resize behavior.
- Label preview-only and planned services accurately; replace sample imagery with the user's own work during onboarding.

No interface is perfect by appearance alone. Portfi's design quality should be judged by whether new users can create an attractive portfolio and confidently publish it.
