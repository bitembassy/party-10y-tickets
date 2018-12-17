import fs   from 'fs'
import path from 'path'
import only from 'only'
import { createHmac } from 'crypto'
import { crypto, BTCPayClient }from 'btcpay'
import { pwrap } from './util'

const btcpay = {
  onchain: new BTCPayClient(process.env.BTCPAY_URL
                          , crypto.load_keypair(Buffer.from(process.env.BTCPAY_ONCHAIN_KEY, 'hex'))
                          , { merchant: process.env.BTCPAY_ONCHAIN_MERCHANT })

, lightning: new BTCPayClient(process.env.BTCPAY_URL
                          , crypto.load_keypair(Buffer.from(process.env.BTCPAY_LN_KEY, 'hex'))
                          , { merchant: process.env.BTCPAY_LN_MERCHANT })
}

const app = require('express')()
app.set('port', process.env.PORT || 9116)
app.set('host', process.env.HOST || 'localhost')
app.set('title', process.env.TITLE || 'Lightning Nano POS')
app.set('currency', process.env.CURRENCY || 'ILS')
app.set('theme', process.env.THEME || 'yeti')
app.set('views', path.join(__dirname, '..', 'views'))
app.set('trust proxy', process.env.PROXIED || 'loopback')

const cbKey = createHmac('sha256', process.env.BTCPAY_LN_KEY).update('callback-key').digest('hex')
const cbURL = `${ process.env.CALLBACK_URL }/callback/${cbKey}`
const thankyouURL = `${ process.env.PUBLIC_URL }/thankyou`

const usdRate = process.env.ILS_USD_RATE || 3.767

const pricesILS = {
  lightning: +process.env.PRICE_LIGHTNING || 21
, onchain:   +process.env.PRICE_ONCHAIN   || 35
}

const pricesUSD = {
  lightning: Math.round(pricesILS.lightning / usdRate)
, onchain:   Math.round(pricesILS.onchain / usdRate)
}

const prices = app.locals.prices = { ILS: pricesILS, USD: pricesUSD }

app.use(require('cookie-parser')())
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: true }))
app.use(require('morgan')('dev'))

app.post(`/callback/${cbKey}`, require('./email-notifications'))

app.use(require('csurf')({ cookie: true }))

app.get('/', (req, res) => res.render('index.pug', { req }))
app.get('/en', (req, res) => res.render('english.pug', { req }))

app.use('/bootswatch', require('express').static(path.resolve(require.resolve('bootswatch/package'), '..', 'dist')))

// use pre-compiled browserify bundle when available, or live-compile for dev
const compiledBundle = path.join(__dirname, 'client.bundle.min.js')
if (fs.existsSync(compiledBundle)) app.get('/script.js', (req, res) => res.sendFile(compiledBundle))
else app.get('/script.js', require('browserify-middleware')(require.resolve('./client')))

app.post('/invoice', pwrap(async (req, res) => {
  const method   = req.body.method
      , persons  = req.body.persons
      , tickets  = persons && persons.length
      , currency = req.body.currency || 'ILS'
      , lang     = req.body.lang || 'he'

  if (![ 'lightning', 'onchain' ].includes(method))
    return res.status(400).end('Invalid payment method')

  if (![ 'ILS', 'USD' ].includes(currency))
    return res.status(400).end('Invalid currency')

  if (![ 'he', 'en' ].includes(lang))
    return res.status(400).end('Invalid language')

  if (!persons || !persons.length || !persons[0] || !persons[0].name)
    return res.status(400).end('Invalid persons')

  const personsText = persons.map(p => `${p.name} <${p.email}>`).join(', ')

  const inv = await btcpay[method].create_invoice({
    price: prices[currency][method] * tickets
  , currency
  , notificationUrl: cbURL
  , itemDesc: `Bitcoin Birthday Party: ${ tickets == 1 ? `Ticket for ${persons[0].name} <${persons[0].email}>`
                                                          : `${tickets} tickets` }`
  , itemCode: personsText
  , posData: JSON.stringify({ lang, persons })
  })

  console.log('Invoice created:', inv)

  res.send(only(inv, 'id'))
}))

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
