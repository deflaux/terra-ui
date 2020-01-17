const express = require('express')
const _ = require('lodash/fp')
const puppeteer = require('puppeteer')
const { promiseHandler, Response } = require('./utils')
const { findWorkflowTest } = require('../tests/find-workflow.integration-test.js')

const app = express()

const getBrowser = _.once(() => puppeteer.launch())
const getContext = async () => {
  const browser = await getBrowser()
  return browser.createIncognitoBrowserContext()
}

app.post('/test/find-workflow', promiseHandler(async req => {
  const context = await getContext()
  await findWorkflowTest.fn({ context })
  return new Response(200)
}))

app.listen(process.env.PORT || 8080)
