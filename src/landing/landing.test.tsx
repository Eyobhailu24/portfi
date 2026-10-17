// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LandingMotion } from "./motion/landing-motion";
import { TemplateGallery } from "./components/template-gallery";
import { Faq } from "./components/faq";
import { SiteHeader } from "./components/site-header";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("portfi:landing:motion", "paused");
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

describe("landing interactions with motion paused", () => {
  it("filters actual template links and exposes FAQ answers through accessible controls", async () => {
    render(<LandingMotion><TemplateGallery /><Faq /></LandingMotion>);
    expect(screen.getAllByRole("link").length).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    await waitFor(() => expect(screen.getAllByRole("link").length).toBe(1));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/editor?template=developer");
    const question = screen.getByRole("button", { name: "Where does my portfolio live?" });
    expect(question.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(question);
    expect(question.getAttribute("aria-expanded")).toBe("true");
    const answer = screen.getByRole("region", { name: "Where does my portfolio live?" });
    expect(answer.textContent).toContain("Direct account connections and in-app deployment are being built");
    fireEvent.click(question);
    expect(answer.getAttribute("aria-hidden")).toBe("true");
  });

  it("persists the motion control and closes mobile navigation with Escape", async () => {
    const { container } = render(<LandingMotion><SiteHeader /></LandingMotion>);
    expect(container.querySelector(".landing-site")?.getAttribute("data-motion")).toBe("off");
    fireEvent.click(screen.getByRole("button", { name: "Turn on animations" }));
    await waitFor(() => expect(localStorage.getItem("portfi:landing:motion")).toBe("playing"));
    fireEvent.click(screen.getByRole("button", { name: "Pause animations" }));
    expect(localStorage.getItem("portfi:landing:motion")).toBe("paused");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded")).toBe("false");
  });
});
