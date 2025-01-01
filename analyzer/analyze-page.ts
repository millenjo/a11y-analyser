import { parentPort } from 'node:worker_threads'
import puppeteer from 'puppeteer'
import { AxePuppeteer } from '@axe-core/puppeteer'
import type { AxeResults } from 'axe-core/axe.ts'

export type AnalyzeMessageTask = {
  url: string
}

export type AnalyzeResult = {
  violations: AxeResults['violations']
  links: string[]
}

const isAnalyzeMessage = (message: unknown): message is AnalyzeMessageTask => {
  return (message as AnalyzeMessageTask).url !== undefined
}

if (!parentPort) {
  throw new Error('This module must be run as a worker')
}

parentPort.on('message', async (message: unknown) => {
  if (!isAnalyzeMessage(message)) {
    parentPort?.postMessage({ error: 'Invalid message format' })
    return
  }

  const url = message.url
  let browser = null

  console.log('Launching browser')
  browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(url)

  const results = await new AxePuppeteer(page).analyze()
  console.log('Closing browser')

  const links = await page.$$eval('a', (elements) =>
    elements.map((a) => a.href)
  )
  await browser?.close()
  browser = null

  parentPort.postMessage({
    violations: results.violations.map((violation) => violation.id),
    links,
  })
})
