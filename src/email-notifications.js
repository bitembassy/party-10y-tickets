const mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_APIKEY, domain: process.env.MAILGUN_DOMAIN });

const mailFrom    = process.env.MAIL_FROM || 'party@bitcoin.org.il'
    , mailNotify  = process.env.MAIL_NOTIFY || 'noa@bitcoin.org.il'
    , mailSubject = process.env.MAIL_SUBJECT || '[Bitcoin Party] Ticket purchased successfully'
    , mailTmpls   = {
        he: require('fs').readFileSync('./email-tmpl-he.txt').toString()
      , en: require('fs').readFileSync('./email-tmpl-en.txt').toString()
      }

async function sendMail(inv) {
  const posData     = JSON.parse(inv.posData)
      , personsText = posData.persons.map(p => `${p.name} <${p.email}>`).join('\n')
      , isLightning = !!inv.paymentSubtotals.BTC_LightningLike
      , lang        = posData.lang || 'he'
      , mailTmpl    = mailTmpls[lang]

  await mailgun.messages().send({
    from: mailFrom
  , to: mailNotify
  , subject: `[Bitcoin Party] ${posData.persons.length} tickets purchased `
  , text: `Tickets purchased for:\n\n${personsText}\n\n${JSON.stringify(inv, null, 2)}`
  })

  await Promise.all(posData.persons.map(p => {
    const text = mailTmpl.replace('{{name}}', p.name)
                         .replace(isLightning  ? /\[\/?LN\]/g : /\[LN\][\s\S]*?\[\/LN\]/g, '')
                         .replace(!isLightning ? /\[\/?ONCHAIN\]/g : /\[ONCHAIN\][\s\S]*?\[\/ONCHAIN\]/g, '')
        , html = `<div${ lang == 'he' ? ' style="direction:rtl;text-align:right"' : '' }><p>${ text.replace(/\n\n/g, '</p><p>') }</p></div>`

    return mailgun.messages().send({
      from: mailFrom
    , to: p.email
    , subject: mailSubject
    , text
    , html
    })
  }))
}

module.exports = (req, res) => {
  res.status(204).end()

  console.log('Invoice paid:', req.body)

  sendMail(req.body).then(_ => console.log('Email sent'))
                    .catch(console.error)
}
