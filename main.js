const inquirer = require('inquirer');
const { classSearch, classEnrollmentData, register, sendEmail, wait } = require('./solar_functions');

// generates random integer between min and max (exclusive)
const randInt = (min, max) => Math.floor(Math.random() * (max - min) + min);

async function main() {
    let semesterOptions = '';
    const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
    const semesters = [];
    const currentYear = new Date().getFullYear();
    let optionNumber = 1;
    for (let year = currentYear; year < currentYear + 2; year++) {
        for (const season of seasons) {
            semesterOptions += `\n(${optionNumber++}) ${season} ${year}`;
            semesters.push(`${season} ${year}`);
        }
    }
    try {
        const { semesterOption } = await inquirer.prompt([{
            type: 'input',
            name: 'semesterOption',
            message: `${semesterOptions}\nChoose a semester (1/2/3/4/5/6/7/8): `,
            validate: function (val) {
                const value = parseInt(val);
                if (isNaN(value) || value < 1 || value > 8) {
                    return false;
                }
                return true;
            },
        }]);
        const semester = semesters[semesterOption-1];

        // TODO: implement lookup by course department/code
        //
        // const { lookupBy } = await inquirer.prompt([{
        //     type: 'input',
        //     name: 'lookupBy',
        //     message: "Look up course by\n  (1) Class Number\n  (2) Course department/code\nEnter 1 or 2: ",
        //     validate: function (val) {
        //         const value = parseInt(val);
        //         if (value !== 1 && value !== 2) {
        //             return false;
        //         }
        //         return true;
        //     },
        // }]);

        const lookupBy = '1'; // TODO: remove

        if (lookupBy === '1') {
            const { classNumber } = await inquirer.prompt([{
                type: 'input',
                name: 'classNumber',
                message: "Enter class number: ",
                validate: val => !isNaN(parseInt(val))
            }]);
            
            const { courseCode, courseTitle, instructor, time } = await classSearch(classNumber, semester);
            console.log(`${courseCode} - ${courseTitle}\nInstructor: ${instructor}\nDays & Time: ${time}\n`);
            const { shouldContinue } = await inquirer.prompt([{
                type: 'input',
                name: 'shouldContinue',
                message: "Continue with this course? (Y/N)",
                validate: (val) => {
                    if (val === 'y' || val === 'Y' || val === 'n' || val === 'N') {
                        return true;
                    } else {
                        return false;
                    }
                },
            }]);
            if (shouldContinue === 'n' || shouldContinue === 'N') {
                return;
            }

            const { autoregister } = await inquirer.prompt([{
                type: 'input',
                name: 'autoregister',
                message: 'Enable auto-registration? (Y/N)',
                validate: function (val) {
                    if (val === 'y' || val === 'Y' || val === 'n' || val === 'N') {
                        return true;
                    } else {
                        return false;
                    };
                },
            }]);

            let solarId, solarPw;
            if (autoregister ==='Y' || autoregister === 'y') {
                solarId = (await inquirer.prompt([{
                    type: 'input',
                    name: 'solarId',
                    message: 'Enter SOLAR ID: ',
                }])).solarId;
                solarPw = (await inquirer.prompt([{
                    type: 'password',
                    name: 'solarPw',
                    message: 'Enter SOLAR password: ',
                }])).solarPw;
            }

            const { emailNotification } = await inquirer.prompt([{
                type: 'input',
                name: 'emailNotification',
                message: 'Enable email notification? (Y/N)',
                validate: function (val) {
                    if (val === 'y' || val === 'Y' || val === 'n' || val === 'N') {
                        return true;
                    } else {
                        return false;
                    };
                },
            }]);

            let emailAddress;
            if (emailNotification === 'y' || emailNotification === 'Y') {
                emailAddress = (await inquirer.prompt([{
                    type: 'input',
                    name: 'emailAddress',
                    message: 'Enter email address to send notification to: ',
                }])).emailAddress;
            }

            while (true) {
                const classEnrollment = await classEnrollmentData(classNumber, semester);
                console.log(`${courseCode} - ${courseTitle} | Open Seats: ${classEnrollment["SU_ENRL_AVAL"]} | Open Waitlist Spots: ${classEnrollment["WAITLIST_POS"]} | Reserved Seats: ${classEnrollment["RSRV_CAP_NBR"]}\n`);
                if (emailNotification === 'y' || emailNotification === 'Y') {
                    const emailMessage = `Class ${classNumber} has open seats or waitlist.`
                    sendEmail(emailAddress, emailMessage);
                }
                if (autoregister ==='Y' || autoregister === 'y' && (classEnrollment["SU_ENRL_AVAL"] > 0 || classEnrollment["WAITLIST_POS"] > 0)) {
                    await register(classNumber, semester, solarId, solarPw);
                    break;
                }
                await wait(randInt(5, 8) * 1000);
            }
        }
        
    } catch (err) {
        console.log(err)
    }

}

main();
