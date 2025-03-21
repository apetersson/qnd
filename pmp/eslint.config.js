// eslint.config.js
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
    // TypeScript configuration
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {jsx: true},
                ecmaVersion: "latest",
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            react: reactPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "error",
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ],
            "react/react-in-jsx-scope": "off",
            "@typescript-eslint/no-empty-object-type": "off"
        }
    },
    // Global configuration
    {
        ignores: ["node_modules/", "dist/"],
    },
];