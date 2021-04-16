# artefact-page-speed-insights-script.gs
## Using the Artefact page speed script
In our recent webinar discussing the Google Page Experience update coming in May we teased you all with a free script that would help you measure your website’s page speed. Well, we’re delighted to announce this script is now ready to share with you all. I know crazy right, Artefact are the kindest people in the world?!

Using the script requires zero coding knowledge (phew), but you will need to carefully follow the instructions below in order to get it up and running correctly. Sounds easy enough, but you might want to clear distractions for 20 minutes and have a cup of strong coffee to hand.
### So first things first, what does the script do?
The script relies on a Google Sheets spreadsheet where you will list the URLs that you’d like to be tested each day. The script will test each URL individually using Google’s Page Speed Insights API and then write the results of each test back into the sheet sequentially.

Some of the information captured by the script for each URL tested includes:
* Page level Core Web Vitals data from the [Chrome User Experience Report dataset](https://developers.google.com/web/tools/chrome-user-experience-report)
* [Speed Index](https://web.dev/speed-index/) score
* [Lighthouse performance score](https://web.dev/performance-scoring/)
* Lab metrics including [First Contentful Paint](https://web.dev/first-contentful-paint/), [Largest Contentful Paint](https://web.dev/lcp/), [Cumulative Layout Shift](https://web.dev/cls/), [Time to Interactive](https://web.dev/interactive/) & [Total Blocking Time](https://web.dev/lighthouse-total-blocking-time/)
* [Time To First Byte](https://web.dev/time-to-first-byte/)
* Resource counts and size of primary HTML, Scripts, CSS, Images, Fonts etc.
* Parsing, evaluation, style layout, paint compositing and garbage collection time for the page render
### How can this data be used?
It’s very simple to hook your results spreadsheet up to Google Data Studio in order to start visualising your data. This allows you to monitor any of the KPIs listed above and to check for daily variations.

Some questions this data may help answer:
* Which of my pages pass the Core Web Vitals test?
* How does my page speed differ between desktop and mobile?
* Has a recent site release affected my page speed?
* How do key pages on my site stack up against competitor’s pages?

Okay so we’ve got your interest, let’s get it setup!
### Credit where credit’s due
Before we go any further we need to call out that this script was based upon the effort of Google’s page speed guru [Rick Viscomi](https://twitter.com/rick_viscomi). We had added further automation, additional error handling/logging and expanded the number of metrics collected by [Rick’s original work](https://dev.to/chromiumdev/a-step-by-step-guide-to-monitoring-the-competition-with-the-chrome-ux-report-4k1o), to create a comprehensive page speed monitoring solution.

Right, now let’s get this done...
## Setting everything up
### Prerequisites
You will need either a Gmail powered email account, or alternatively a Google account associated with another email address. Google provides instructions on [how to associate a Google account with another email address](https://support.google.com/accounts/answer/27441#existingemail), under the heading ‘Use an existing email address’
A Page Speed Insights API key. You can [acquire an API key here](https://developers.google.com/speed/docs/insights/v5/get-started?pli=1) by selecting the ‘Get a key’ button. Click Create new project and specify a suitable name like ‘Page speed project’. Accept the terms of service and click next. You will be provided with your API key in the following dialogue. **Save this key somewhere safe**

### Creating your copy of the Google Sheets spreadsheet and getting your spreadsheet’s unique ID
The [Artefact page speed spreadsheet can be accessed here](https://docs.google.com/spreadsheets/d/119pFKTFocgzoFGtUYnsqE_IYruXc48LPSkKMgmzE4Pg/copy#gid=1069391545). Opening the link will prompt you to make a copy of the spreadsheet to your own Google Drive. You should be logged into Google using the same account throughout this entire process.

Each spreadsheet has a unique ID that our script will use to read and write back to the correct spreadsheet. The Spreadsheet ID can be found in the URL of your sheet. When viewing any tab within the sheet, look in your browser’s address bar. You will need to make note of the following part of the URL in your browser bar highlighted in green below:

https://docs.google.com/document/d/1Z_m72w0iBdSSTc48DZ_WFK6x8374dkkxdlGlOSbIs_5ULg/edit#

The Spreadsheet ID for the URL above would be the green portion that appears after /d/ in the URL and ends at the next forward slash. E.g.:

1Z_m72w0iBdSSTc48DZ_WFK6x8374dkkxdlGlOSbIs_5ULg

**Make a note of your spreadsheet ID and keep somewhere to hand for later.**

### Setting up the page speed script
You can find the page speed script hosted here on GitHub. Have this page open in a tab on your browser. In another tab you will now need to setup an empty script in Google Apps Script.

1. Go to the following URL: https://script.google.com/create
1. You will need to sign in if you haven’t already
1. You will have been taken directly to the script editor, with a new blank script open
1. First things first, we need to switch to the legacy code editor since the new editor is missing features we need to use. In the top right corner select ‘Use legacy editor’ following any prompts until you arrive at the legacy script editor interface
1. Click on the current project name ‘Untitled project’ and change it to something you’ll easily recognise and be able to find again, like ‘Page Speed Insights script’
1. Back in GitHub, select ‘Raw’ in order to see the entire piece of code

1. Press Ctrl+A (Cmd+A on a Mac) to select all of the code
1. Press Ctrl+C (Cmd+C on a Mac) to copy the code
1. Back in the Google Apps Script editor, click within the main code area. It should look like this:

1. Press Ctrl+A (Cmd+A on a mac) to select all default code and press delete. We don’t need this at all
1. Now paste the copied GitHub code into the Google Apps Script editor, it should now look like the following

1. Make use of the save option to commit your changes. We now need to make some amendments to the code so that it can connect to your spreadsheet that you previously setup
1. Firstly, click File -> Project properties and select the ‘Script properties’ tab. Click to add a new row and for the property name add ‘PSI_API_KEY’. For the property value, paste in your page speed insights API key and click save

1. Back in the editor you will see a line saying var SPREADSHEET_ID = “UPDATE_THIS_HERE”. You will need to replace everything between the double quotes with your spreadsheet ID that you made a note of right at the start of this process. Save your script again
1. We’re now ready to test the script and permit Google Apps Script to access our spreadsheet. In the ‘Select function’ dropdown select ‘monitorV5’ and press the Play button to its left. The script will execute and a series of dialog boxes will appear asking you to allow the script to interface with the spreadsheet. Accept each of these

1. If you’ve followed everything correctly the script will now be running. During this process it tests the dummy URL (https://www.example.com/) that was already in the ‘SourceURLs’ tab. After a minute or two, you should see a row of data written to the ‘Results SPI v5’ tab. Congratulations the script is correctly configured, you did it! If you encounter any errors, or no data was written to the results tab then please walk back through this process and ensure you completed every step
1. If the script ran correctly you can now populate the ‘SourceURLs’ sheet of the spreadsheet with any URLs you’d like to test, be sure to overwrite the example URL that was already in the tab. We’d recommend an upper limit of about 30 URLs, as the script will terminate after it’s been running for a maximum time of 30 minutes and any URLs not yet tested will just get missed out. Ensure you use fully qualified URLs with the protocol (http:// or https://) at the start, ideally copy each URL from your browser’s address bar to be safe
1. Now we want to setup a trigger that will fire our script each day at a given time. We’ll use the ‘Triggers’ button below to do so:

1. You will now be taken to the Triggers page. Click ‘Add Trigger’ in the bottom right which will open a Trigger dialogue. Use the following settings:
  - Choose which function to run: monitorV5
  - Choose which deployment should run: Head (default option)
  - Select event source: Time-driven (default option)
  - Select type of time based trigger: Day timer
  - Select time of day: 4am to 5am

  Now click save, your trigger is deployed and your script will run automatically between 4-5am each morning

You’re awesome! [Insert appropriate meme here]
## Next steps…
Now that you have lots of lovely data getting collected each day you’re probably going to want to start visualising that data right?? [Google Data Studio](https://datastudio.google.com/u/0/navigation/reporting) is a free dashboard tool that can help you out here.

What’s that? You’d like some help setting up a page speed dashboard for yourself? Well, you’re in luck. Look out for a walkthrough guide coming up from the Artfeact team coming soon!
