<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-4">
	{@render children()}
</div>
