require('babel-polyfill')

;(function(){ // IIFE

const $ = require('jquery')
    , btcpay = require('./client-btcpay')
    , personView = require('../views/person.pug')

const csrf = $('meta[name=csrf]').attr('content')
    , lang = $('html').attr('lang')
    , prices = JSON.parse($('meta[name=prices]').attr('content'))
    , currency = $('meta[name=currency]').attr('content')

btcpay.setApiUrlPrefix($('meta[name=btcpay-url]').attr('content'))

//
// Person details
//

const personsEl = $('.persons')

function personAdd() {
  personsEl.append(personView({ lang, btn_type: 'remove' }))
  updatePrices()
}

function personRemove(e){
  $(e.target).closest('.person').remove()
  updatePrices()
}

function updatePrices() {
  const persons = $('.person').length
  $('.price-onchain').text(persons * prices.onchain)
  $('.price-lightning').text(persons * prices.lightning)
}

//
// Payment
//

async function pay(e) {
  e.preventDefault()

  const btn    = $(e.target).find('button[type=submit]:focus')[0] || lastBtn
      , method = btn && btn.value || 'onchain'
      , names  = $('input[name=name]').get().map(el => el.value)
      , emails = $('input[name=email]').get().map(el => el.value)
      , persons = names.map((name, i) => ({ name, email: emails[i] }))

  $('button, [data-do], :input').prop('disabled', true)

  try {
    const inv = await $.post('invoice', { currency, lang, method, persons, _csrf: csrf })
    btcpay.showInvoice(inv.id)
  }
  finally {
    setTimeout(_ => $(':disabled').attr('disabled', false), 5000)
  }

}

let lastBtn
function btnClick(e) {
  lastBtn = e.target
}


$(document.body)
  .on('click', '[data-do=person-add]', personAdd)
  .on('click', '[data-do=person-remove]', personRemove)
  .on('click', '[type=submit]', btnClick)
  .on('submit', 'form', pay)

})()
