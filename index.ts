async function getStreamData(url: string) {
  console.log('Get it!')

  const response = await fetch('http://localhost:8000/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: url }),
  })

  console.log(1)

  const reader = response.body?.getReader()
  let buffer = '' // Buffer to store incomplete chunks

  console.log(2)

  if (!reader) {
    throw new Error('No reader found')
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += new TextDecoder().decode(value)

    try {
      const result = JSON.parse(buffer)

      // If we successfully parsed the JSON, we can clear the buffer
      buffer = ''

      // Handle different types of messages
      if ('initiatedUrl' in result) {
        console.log('Started analyzing:', result.initiatedUrl)
      } else {
        console.log('Analysis results:', {
          url: result.url,
          violations: result.violations,
          links: result.links,
        })
      }
    } catch (e) {
      // If JSON.parse fails, we keep the buffer and wait for more data
      console.log('Error', e)

      continue
    }
  }
}

getStreamData('https://www.babybjorn.com')
