const mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_APIKEY, domain: process.env.MAILGUN_DOMAIN });

const mailFrom    = process.env.MAIL_FROM || 'party@bitcoin.org.il'
    , mailNotify  = process.env.MAIL_NOTIFY || 'noa@bitcoin.org.il'
    , mailSubject = process.env.MAIL_SUBJECT || '[Bitcoin Party] Ticket purchased successfully'
    , mailTmpl    = process.env.MAIL_TMPL || require('fs').readFileSync('./email-tmpl.txt').toString()

async function sendMail(inv) {
  const persons = JSON.parse(inv.posData).persons
      , personsText = persons.map(p => `${p.name} <${p.email}>`).join('\n')
      , isLightning = !!inv.paymentSubtotals.BTC_LightningLike

  await mailgun.messages().send({
    from: mailFrom
  , to: mailNotify
  , subject: `[Bitcoin Party] ${persons.length} tickets purchased `
  , text: `Tickets purchased for:\n\n${personsText}\n\n${JSON.stringify(inv, null, 2)}`
  })

  await Promise.all(persons.map(p => {
    const text = mailTmpl.replace('{{name}}', p.name)
                         .replace(isLightning  ? /\[\/?LN\]/g : /\[LN\][\s\S]*?\[\/LN\]/g, '')
                         .replace(!isLightning ? /\[\/?ONCHAIN\]/g : /\[ONCHAIN\][\s\S]*?\[\/ONCHAIN\]/g, '')
        , html = `<div style="direction:rtl;text-align:right"><p>${ text.replace(/\n\n/g, '</p><p>') }</p></div>`

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
