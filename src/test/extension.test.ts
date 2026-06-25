import * as assert from 'assert';
import { analyzeVueSfc } from '../analyzer';

suite('Extension Test Suite', () => {
	test('detects common Vue class binding patterns', () => {
		const analysis = analyzeVueSfc(`
			<template>
				<div
					class="static-class secondary"
					:class="[
						'array-class',
						{ active: isActive, disabled: isDisabled },
						isPrimary ? 'primary-class' : 'fallback-class'
					]"
				/>
			</template>
			<style>
				.static-class { color: #ffffff; }
				.secondary { color: #ffffff; }
				.array-class { color: #ffffff; }
				.active { color: #ffffff; }
				.disabled { color: #ffffff; }
				.primary-class { color: #ffffff; }
				.fallback-class { color: #ffffff; }
				.unused-class { color: #ffffff; }
			</style>
		`);

		for (const className of [
			'static-class',
			'secondary',
			'array-class',
			'active',
			'disabled',
			'primary-class',
			'fallback-class'
		]) {
			assert.strictEqual(analysis.usedClassCounts.get(className), 1, `${className} should be used`);
		}

		assert.strictEqual(analysis.usedClassCounts.get('unused-class'), undefined);
	});

	test('detects escaped CSS class selectors as their template names', () => {
		const analysis = analyzeVueSfc(`
			<template>
				<div class="sm:mt-4 w-[10px] hover:bg-blue-500 grouped-item"></div>
			</template>
			<style>
				.sm\\:mt-4 { color: #ffffff; }
				.w-\\[10px\\] { color: #ffffff; }
				.hover\\:bg-blue-500:hover,
				.grouped-item > span { color: #ffffff; }
			</style>
		`);

		for (const className of ['sm:mt-4', 'w-[10px]', 'hover:bg-blue-500', 'grouped-item']) {
			assert.ok(analysis.declaredClasses.has(className), `${className} should be declared`);
			assert.strictEqual(analysis.usedClassCounts.get(className), 1, `${className} should be used`);
		}
	});

	test('detects script string class and id usage', () => {
		const analysis = analyzeVueSfc(`
			<template>
				<section id="hero"></section>
			</template>
			<script setup>
				const panelClasses = ['from-script', 'script-selected'];
				document.querySelector('.query-class #query-id');
				document.getElementById('script-id');
			</script>
			<style>
				#from-style-unused { color: #ffffff; }
				#hero { color: #ffffff; }
				#query-id { color: #ffffff; }
				#script-id { color: #ffffff; }
				.from-script { color: #ffffff; }
				.script-selected { color: #ffffff; }
				.query-class { color: #ffffff; }
				.unused-class { color: #ffffff; }
			</style>
		`);

		for (const className of ['from-script', 'script-selected', 'query-class']) {
			assert.strictEqual(analysis.usedClassCounts.get(className), 1, `${className} should be used`);
		}

		for (const id of ['hero', 'query-id', 'script-id']) {
			assert.strictEqual(analysis.usedIdCounts.get(id), 1, `${id} should be used`);
		}

		assert.strictEqual(analysis.usedClassCounts.get('unused-class'), undefined);
		assert.strictEqual(analysis.usedIdCounts.get('from-style-unused'), undefined);
	});
});
