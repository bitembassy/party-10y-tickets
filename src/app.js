import fs      from 'fs'
import path    from 'path'
import only    from 'only'
import { pwrap, fiatFormatter } from './util'

const app    = require('express')()
    , charge = require('lightning-charge-client')(process.env.CHARGE_URL, process.env.CHARGE_TOKEN)
    , items = {}

app.set('port', process.env.PORT || 9116)
app.set('host', process.env.HOST || 'localhost')
app.set('title', process.env.TITLE || 'Lightning Nano POS')
app.set('currency', process.env.CURRENCY || 'BTC')
app.set('theme', process.env.THEME || 'yeti')
app.set('views', path.join(__dirname, '..', 'views'))
app.set('trust proxy', process.env.PROXIED || 'loopback')

app.locals.formatFiat = fiatFormatter(app.settings.currency)

app.use(require('cookie-parser')())
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: false }))

app.use(require('morgan')('dev'))
app.use(require('csurf')({ cookie: true }))

app.get('/', (req, res) => res.render('index.pug', { req, items }))

app.use('/bootswatch', require('express').static(path.resolve(require.resolve('bootswatch/package'), '..', 'dist')))

// use pre-compiled browserify bundle when available, or live-compile for dev
const compiledBundle = path.join(__dirname, 'client.bundle.min.js')
if (fs.existsSync(compiledBundle)) app.get('/script.js', (req, res) => res.sendFile(compiledBundle))
else app.get('/script.js', require('browserify-middleware')(require.resolve('./client')))

app.post('/invoice', pwrap(async (req, res) => {
  const info = req.body
  const inv = await charge.invoice({
    amount: process.env.PRICE || 18
  , currency: process.env.CURRENCY || 'ILS'
  , description: `Bitcoin Birthday Party! Ticket for ${info.name} <${info.email}>`
  , expiry: 5990
  , metadata: { source: 'party-2018', name: info.name, email: info.email }
  })
  res.send(only(inv, 'id payreq msatoshi quoted_currency quoted_amount expires_at'))
}))

app.get('/invoice/:invoice/wait', pwrap(async (req, res) => {
  const paid = await charge.wait(req.params.invoice, 100)
  res.sendStatus(paid === null ? 402 : paid ? 204 : 410)
}))

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
