/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF9F5",
        ink: "#172F29",
        muted: "#52635C",
        line: "#D7DFD5",
        leaf: "#075A53",
        coral: "#16CBCD",
        berry: "#286C59",
        sky: "#E6F1E5",
        oat: "#EDF1E9",
      },
      boxShadow: {
        soft: "0 4px 16px rgba(23, 47, 41, 0.07)",
        inset: "inset 0 0 0 1px rgba(0, 105, 107, 0.12)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
