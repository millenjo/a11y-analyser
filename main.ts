import type { AnalyzeMessageTask } from './analyzer/analyze-page.ts'
import PageAnalyzerWorkerPool from './analyzer/worker-pool.ts'
import os from 'node:os'
// import type { AxeResults } from 'axe-core/axe.ts'

// type AnalyzePageResult =
//   | {
//       violations: AxeResults['violations']
//       links: string[]
//       url: string
//     }
//   | {
//       initiatedUrl: string
//     }

if (import.meta.main) {
  const splitIntoChunksOf20 = (array: string[]) => {
    const chunks = []
    for (let i = 0; i < array.length; i += 20) {
      chunks.push(array.slice(i, i + 20))
    }
    return chunks
  }
  // TODO Implement storage of the analyzed urls
  const analyzePage = (
    task: AnalyzeMessageTask,
    pool: PageAnalyzerWorkerPool,
    controller: ReadableStreamDefaultController<string>,
    retries = 0,
    analyzedUrlsPaths: string[] = []
  ) => {
    if (analyzedUrlsPaths.includes(task.url)) {
      return
    } else {
      analyzedUrlsPaths.push(task.url)
    }

    const taskUrl = new URL(task.url)

    controller.enqueue(
      JSON.stringify({
        initiatedUrl: task.url,
      })
    )

    pool.runTask(task, (err, result) => {
      const internalLinks =
        result?.links.filter((link) => {
          const url = new URL(link)
          return (
            url.hostname === taskUrl.hostname &&
            !analyzedUrlsPaths.includes(link)
          )
        }) ?? []

      if (err && retries < 3) {
        try {
          analyzePage(task, pool, controller, retries + 1, analyzedUrlsPaths)
        } catch {
          controller.error(err)
        }
      } else if (err) {
        console.error(err)
      } else if (internalLinks.length > 0) {
        const chunks = splitIntoChunksOf20(internalLinks)

        controller.enqueue(
          JSON.stringify({
            url: task.url,
            violations: result?.violations ?? [],
          })
        )

        for (const chunk of chunks) {
          controller.enqueue(
            JSON.stringify({
              links: chunk,
            })
          )
        }

        internalLinks.forEach((link) => {
          analyzePage({ url: link }, pool, controller, 0, analyzedUrlsPaths)
        })
      }
    })
  }

  Deno.serve({ port: 8000 }, async (req: Request) => {
    const requestBody = await req.json()

    const body = new ReadableStream({
      start(controller) {
        const pool = new PageAnalyzerWorkerPool(os.availableParallelism())
        try {
          analyzePage({ url: requestBody.url }, pool, controller)
        } catch (e) {
          controller.error(e)
          throw e
        }
      },
      cancel() {},
    }).pipeThrough(new TextEncoderStream())

    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream',
        'x-content-type-options': 'nosniff',
      },
    })
  })

  console.log('Server running on http://localhost:8000')
}
