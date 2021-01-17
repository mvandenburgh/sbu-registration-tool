const path = require('path');
const axios = require('axios');
const mailgun = require('mailgun-js');
const { parse } = require('node-html-parser');
const xml2js = require('xml2js');
const puppeteer = require('puppeteer');

const SOLAR_ADD_CLASS_URL = 'https://psns.cc.stonybrook.edu/psc/csprods/EMPLOYEE/CAMP/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?PORTALPARAM_PTCNAV=HC_SSR_SSENRL_CART_GBL&EOPP.SCNode=CAMP&EOPP.SCPortal=EMPLOYEE&EOPP.SCName=ADMN_SOLAR_SYSTEM&EOPP.SCLabel=Enrollment&EOPP.SCFName=HCCC_ENROLLMENT&EOPP.SCSecondary=true&EOPP.SCPTcname=PT_PTPP_SCFNAV_BASEPAGE_SCR&FolderPath=PORTAL_ROOT_OBJECT.CO_EMPLOYEE_SELF_SERVICE.SU_STUDENT_FOLDER.HCCC_ENROLLMENT.HC_SSR_SSENRL_CART_GBL&IsFolder=false';

const parser = new xml2js.Parser({ explicitArray: false, tagNameProcessors: [xml2js.processors.stripPrefix] });

async function classSearch(classNumber, semester) {
    const results = await axios.get(`http://classfind.stonybrook.edu/vufind/Search/Results?lookfor=${classNumber}&type=AllFields&submit=Find&limit=10&sort=callnumber&filter[]=ctrlnum:"${semester}"`);
    const parsedHtml = parse(results.data);
    const courseCode = parsedHtml.querySelector('#result0').childNodes[3].childNodes[3].childNodes[1].childNodes[1].childNodes[0].rawText;
    const courseTitle = parsedHtml.querySelector('.resultItemLine1').childNodes[1].childNodes[1].childNodes[0].rawText;
    const instructor = parsedHtml.querySelector('.resultItemLine2').childNodes[1].childNodes[0].rawText;
    const time = parsedHtml.querySelector('.resultItemLine2').parentNode.childNodes[5].childNodes[2].rawText.trim();
    return { courseCode, classNumber, courseTitle, instructor, time }
}

async function classEnrollmentData(classNumber, semester) {
    const res = await axios.get(`http://classfind.stonybrook.edu/vufind/AJAX/JSON?method=getItemVUStatuses&itemid=${classNumber}&strm=${getSemesterCode(semester)}&NBR=${classNumber}`);
    const { data } = res.data;
    const parsed = await parser.parseStringPromise(data);
    const SEARCH_RES = parsed?.response?.Envelope?.Body?.root?.SEARCH_RES;
    return SEARCH_RES;
}

async function register(CLASS_NBR, SEMESTER, id, pwd) {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    try {
        await page.goto(SOLAR_ADD_CLASS_URL);
        await page.type('input[name=userid]', id, {delay: 50});
        await page.type('input[name=pwd]', pwd, {delay: 50});
        await page.click('input[name=Submit]', {delay: 50});

        await page.waitForSelector('#DERIVED_REGFRM1_TITLE1');

        let index;
        for (let i = 0; i < 10; i++) {
            let sem = await page.$(`span[id="TERM_CAR$${i}"]`);
            let value = await page.evaluate(el => el.textContent, sem);
            if (value === SEMESTER) {
                index = i;
                break;
            }
        }

        await page.evaluate(({index}) => {
            document.getElementById(`SSR_DUMMY_RECV1$sels$${index}$$0`).click();
        }, {index});
        await page.click('input[name=DERIVED_SSS_SCT_SSR_PB_GO]');

        await page.waitForSelector('#DERIVED_REGFRM1_CLASS_NBR');

        let cartEmpty = false;
        while (!cartEmpty) {
            let cartItem = await page.$('[id="P_DELETE$0"]');
            if (cartItem) {
                cartItem.click();
                await wait(2000);
            } else {
                cartEmpty = true;
            }
        }

        wait(3000);
        await page.type('input[name=DERIVED_REGFRM1_CLASS_NBR]', CLASS_NBR);
        await page.click('input[name="DERIVED_REGFRM1_SSR_PB_ADDTOLIST2$9$"]');

        await page.waitForSelector('#DERIVED_CLS_DTL_DESCR50');

        const waitlistCheckbox = await page.$('input[name="DERIVED_CLS_DTL_WAIT_LIST_OKAY$125$"]');
        if (waitlistCheckbox) {
            await page.click('input[name="DERIVED_CLS_DTL_WAIT_LIST_OKAY$125$"]');
        }
        await page.click('input[name="DERIVED_CLS_DTL_NEXT_PB$280$"]');

        await page.waitForSelector('#DERIVED_REGFRM1_TITLE1');
        await page.click('input[name="DERIVED_REGFRM1_LINK_ADD_ENRL$82$"]');

        await page.waitForSelector('#DERIVED_REGFRM1_SSR_PB_SUBMIT');
        await page.click('input[name=DERIVED_REGFRM1_SSR_PB_SUBMIT]');

        await wait(6000);
        const filename = `${Date.now()}.png`;
        await page.screenshot({ path: path.join(__dirname, filename) });
        console.log(`Registration attempted. See screenshot at ${path.join(__dirname, filename)} to see result.`);
        await browser.close();
    } catch (err) {
        console.log(err);
        const filename = `${Date.now()}.png`;
        await page.screenshot({ path: path.join(__dirname, filename) });

        await browser.close();

        console.log(`ERROR: Registration failed! See screenshot at ${path.join(__dirname, filename)} to see where error occured.`);
    }
}

function getSemesterCode(semester) {
    const season = semester.split(" ")[0].toLowerCase();
    const year = semester.split(" ")[1];
    const code = season === 'fall' ? 858 : season === 'spring' ? 854 : season === 'winter' ? 851 : 856;
    return code + (10 * (year - 1985));
}

const wait = (delay, ...args) => new Promise(resolve => setTimeout(resolve, delay, ...args));

async function sendEmail(recipient, message) {
    const { MAILGUN_DOMAIN, MAILGUN_API_KEY } = process.env;
    const mailgunInstance = mailgun({ apiKey: MAILGUN_API_KEY, domain: MAILGUN_DOMAIN });
    const data = {
        from: `notify@${MAILGUN_DOMAIN}`,
        to: recipient,
        subject: 'SOLAR class notification',
        text: message,
    };
    mailgunInstance.messages().send(data, (err, body) => err ? console.log(err) : undefined);
}

module.exports = { classSearch, classEnrollmentData, getSemesterCode, register, sendEmail, wait }
