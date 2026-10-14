import type { RefObject } from "react";
import { landingSymbolStyle } from "@/components/landing/landing-motion";

const symbols = [
  { text: "</>", x: 43, y: 24 },
  { text: "{ }", x: 91, y: 13 },
  { text: "[ ]", x: 58, y: 84 },
  { text: "->", x: 96, y: 70 },
  { text: "(", x: 27, y: 15 },
  { text: ")", x: 34, y: 66 },
  { text: "=>", x: 71, y: 17 },
  { text: "&&", x: 79, y: 76 },
  { text: "||", x: 51, y: 49 },
  { text: "!=", x: 22, y: 82 },
  { text: "[]", x: 66, y: 35 },
  { text: "{}", x: 13, y: 57 },
  { text: "++", x: 84, y: 47 },
  { text: "==", x: 37, y: 38 },
  { text: "??", x: 88, y: 27 },
  { text: ":", x: 17, y: 30 },
  { text: ";", x: 74, y: 61 },
  { text: "0x", x: 48, y: 11 },
  { text: "for", x: 7, y: 74 },
  { text: "if", x: 62, y: 69 },
  { text: "*/", x: 31, y: 91 },
  { text: "/*", x: 82, y: 91 },
  { text: "<>", x: 54, y: 63 },
  { text: ">>", x: 4, y: 42 },
  { text: "<<", x: 94, y: 38 },
  { text: "{}", x: 40, y: 76 },
];

export function LandingBackground({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={containerRef} className="yard-ambient" aria-hidden="true">
      <span className="yard-ambient-grid" />
      <span className="yard-ambient-orb yard-ambient-orb-one" />
      <span className="yard-ambient-orb yard-ambient-orb-two" />
      <span className="yard-ambient-orb yard-ambient-orb-three" />
      {symbols.map(({ text, x, y }, index) => (
        <span
          className="yard-code-symbol"
          data-symbol-index={index}
          key={`${text}-${index}`}
          style={landingSymbolStyle(index, x, y, symbols.length)}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
