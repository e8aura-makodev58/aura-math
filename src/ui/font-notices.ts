import outfitNotice from "../../assets/fonts/OFL-Outfit.txt?url";
import atkinsonNotice from "../../assets/fonts/OFL-Atkinson-Hyperlegible-Next.txt?url";

export function fontNotices(host: HTMLElement) {
  const footer = document.createElement("footer");
  footer.className = "font-notices";
  footer.setAttribute("aria-label", "Font licences");
  for (const [label, href] of [
    ["Outfit font licence", outfitNotice],
    ["Atkinson font licence", atkinsonNotice],
  ]) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    footer.append(link);
  }
  host.append(footer);
}
