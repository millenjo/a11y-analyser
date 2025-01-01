<script lang="ts">
	import H1 from '$lib/components/typography/h1/h1.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let url = $state('https://www.babybjorn.com');

	async function a11yAnalyzeUrl(url: string) {
		try {
			const response = await fetch(`/api/analyze?url=${url}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.status !== 200) {
				throw new Error('Failed to fetch data');
			}

			const reader = response.body?.getReader();

			if (!reader) {
				throw new Error('No reader');
			}

			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				// Convert Uint8Array to string
				buffer += new TextDecoder().decode(value);
				const objects = buffer.split('}{').map((obj, i, arr) => {
					// Add back the curly braces that were split
					if (i === 0) return obj + '}';
					if (i === arr.length - 1) return '{' + obj;
					return '{' + obj + '}';
				});

				// Parse all complete objects except the last one (might be incomplete)
				for (let i = 0; i < objects.length - 1; i++) {
					try {
						const result = JSON.parse(objects[i]);
						if (result.violations) {
							console.log(result.url);
							(result.violations as string[]).map((violation) => console.log(violation));
						}
					} catch (e) {
						console.error('Parse error:', e);
					}
				}

				// Keep the last (potentially incomplete) object in the buffer
				buffer = objects[objects.length - 1];
			}
		} catch (error) {
			console.error('Error:', error);
		}
	}
</script>

<!-- <div class="flex flex-col items-center justify-center gap-4"> -->
<header class="mt-14">
	<H1>Start analyzing</H1>
</header>
<main class="flex gap-2">
	<Input aria-label="The URL to do the a11y analysis on" type="text" bind:value={url} />
</main>

<Button onclick={() => a11yAnalyzeUrl(url)}>Go!</Button>

<!-- </div> -->
