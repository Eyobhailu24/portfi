import Link from "next/link";
import { Brand } from "@/shared/components/brand";
export default function NotFound() { return <main id="main-content" className="loading-screen"><Brand/><h1>A little off the beaten path.</h1><p>That page isn’t here. Let’s find you a good starting point.</p><Link href="/" className="button button-blue">Back to Portfi ↗</Link></main>; }
