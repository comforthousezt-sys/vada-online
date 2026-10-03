import { useId } from "react";
import { creature } from "../../../shared/content.js";
export function Portrait({
  id,
  large = false,
}: {
  id: string;
  large?: boolean;
}) {
  const c = creature(id),
    gradient = useId();
  return (
    <svg
      className={"portrait " + (large ? "portrait-large" : "")}
      viewBox="0 0 100 110"
      role="img"
      aria-label={"NUMBRA " + id}
    >
      <defs>
        <radialGradient id={gradient}>
          <stop offset="0" stopColor={c.color} />
          <stop offset="1" stopColor="#23383c" />
        </radialGradient>
      </defs>
      <circle
        cx="50"
        cy="58"
        r="44"
        fill={"url(#" + gradient + ")"}
        opacity=".22"
      />
      {id === "MANIPUL" ? (
        <>
          <path
            d="M25 41Q12 9 27 4L40 32M62 31L77 4Q89 18 74 43"
            fill={c.color}
          />
          <path d="M24 14L12 35M79 15L91 32" stroke={c.color} strokeWidth="2" />
        </>
      ) : id === "OBFUSCO" ? (
        <>
          <path
            d="M26 40Q4 12 15 59L30 54M72 40Q95 15 88 65L70 55"
            fill={c.color}
          />
        </>
      ) : id === "PACTA" ? (
        <path d="M27 34L24 19 40 26 49 9 59 26 77 19 73 35" fill="#e3bd76" />
      ) : (
        <>
          <path d="M28 37L18 15 42 30M59 31L83 15 73 40" fill={c.color} />
        </>
      )}
      <ellipse cx="50" cy="83" rx="24" ry="19" fill={c.color} />
      <ellipse cx="50" cy="51" rx="29" ry="28" fill={c.color} />
      <ellipse cx="38" cy="51" rx="9" ry="11" fill="#f8f3e5" />
      <ellipse cx="63" cy="51" rx="9" ry="11" fill="#f8f3e5" />
      <ellipse cx="40" cy="53" rx="4.3" ry="6.5" fill="#14262d" />
      <ellipse cx="61" cy="53" rx="4.3" ry="6.5" fill="#14262d" />
      <circle cx="41" cy="50" r="1.7" fill="#fff" />
      <circle cx="62" cy="50" r="1.7" fill="#fff" />
      <path
        d="M37 69Q50 77 65 67"
        fill="none"
        stroke="#263238"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M45 72l3 7 4-6M59 71l2 5 3-6" fill="#f8f3e5" />
      <ellipse cx="33" cy="101" rx="10" ry="5" fill={c.color} />
      <ellipse cx="67" cy="101" rx="10" ry="5" fill={c.color} />
      {id === "TRADOR" && (
        <>
          <circle
            cx="75"
            cy="85"
            r="10"
            fill="#e3bd76"
            stroke="#846137"
            strokeWidth="2"
          />
          <path
            d="M72 80l3 9 4-9"
            fill="none"
            stroke="#846137"
            strokeWidth="2"
          />
        </>
      )}
      {id === "PACTA" && (
        <rect x="16" y="76" width="13" height="22" rx="3" fill="#e9d9b3" />
      )}
    </svg>
  );
}
