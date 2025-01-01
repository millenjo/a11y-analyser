export const GET = async ({ request }) => {
	const url = new URL(request.url);
	const urlParam = url.searchParams.get('url');

	if (!urlParam) {
		return new Response('URL is required', { status: 400 });
	}

	return fetch('http://localhost:8000', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			url: urlParam
		})
	});
};
