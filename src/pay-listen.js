const mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_APIKEY, domain: process.env.MAILGUN_DOMAIN });

const mailFrom    = process.env.MAIL_FROM || 'party@bitcoin.org.il'
    , mailNotify  = process.env.MAIL_NOTIFY || 'noa@bitcoin.org.il'
    , mailSubject = process.env.MAIL_SUBJECT || '[Bitcoin Party] Ticket purchased successfully'
    , mailTmpl    = process.env.MAIL_TMPL || require('fs').readFileSync('./email-tmpl.txt').toString()


async function sendMail(inv) {
  await mailgun.messages().send({
    from: mailFrom
  , to: mailNotify
  , subject: `[Bitcoin Party] Ticket bought by ${ inv.metadata.name }`
  , text: JSON.stringify(inv, null, 2)
  })

  const text = mailTmpl.replace('{{name}}', inv.metadata.name)
      , html = `<div style="direction:rtl;text-align:right"><p>${ text.replace(/\n\n/g, '</p><p>') }</p></div>`

  await mailgun.messages().send({
    from: mailFrom
  , to: inv.metadata.email
  , subject: mailSubject
  , text
  , html
  })
}

module.exports = charge =>
  charge.stream().on('payment', inv => {
    if (inv.metadata.source == 'party-2018')
      sendMail(inv).then(_ => console.log('Email sent'))
                   .catch(console.error)
  })
