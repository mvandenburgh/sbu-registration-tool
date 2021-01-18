# sbu-registration-tool
Node.js CLI tool to get into closed classes on the Stony Brook SOLAR system.

It continously pings the SBU Classfind website for available seats until a seat opens up. It can be configured to send an email notification and/or automatically register on SOLAR when a seat opens.

## Getting started
Node.js and NPM are required.

```
npm install
node main.js
```

### Email notifications
To enable optional email notifications you must have a Mailgun API key and set the `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` environment variables.

### Automatic registration
The Puppeteer automated browser is used to register for classes on SOLAR. It is unclear whether this violates any rules regarding use of SOLAR, so this functionality is purely a proof of concept and is used at the user's own risk.
