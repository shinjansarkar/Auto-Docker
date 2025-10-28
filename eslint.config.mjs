import globals from 'globals';

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 6,
			sourceType: 'module',
			globals: globals.node
		},
		rules: {
			curly: 'warn',
			eqeqeq: 'warn',
			'no-throw-literal': 'warn',
			semi: 'warn'
		}
	}
];