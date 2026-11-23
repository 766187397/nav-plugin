import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
  {
    name: 'global-ignores',
    ignores: [
      '**/node_modules/**',
      '.output/**',
      '.wxt/**',
      'dist/**',
      'public/**',
      'example/**',
      'eslint.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'global-language-options',
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
      },
    },
  },
  ...pluginVue.configs['flat/recommended'],
  {
    name: 'vue-style-overrides',
    rules: {
      // 关闭纯代码风格规则，避免与现有紧凑模板格式冲突
      'vue/max-attributes-per-line': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    name: 'vue-typescript',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
)