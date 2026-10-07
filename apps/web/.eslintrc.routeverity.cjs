module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, node: true, es2022: true },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": "off",
    "no-undef": "off",
    "no-empty": "error",
    "no-debugger": "error",
    "no-constant-condition": "error",
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          "*icons/nucleo*",
          "*stripe-app*",
          "*app/(ee)*",
          "*upstream-reference*",
        ],
      },
    ],
  },
};
