// Adapted from https://ithoughthecamewithyou.com/post/automate-google-pagespeed-insights-with-apps-script by Robert Ellison
// Adapted from https://dev.to/rick_viscomi/a-step-by-step-guide-to-monitoring-the-competition-with-the-chrome-ux-report-4k1o by Rick Viscomi (@rick_viscomi)

//Constants that you need to update!
//Spreadsheet id (taken from the URL, see notes for more info on this)
var SPREADSHEET_ID = "UPDATE_THIS_HERE";

//You must add your Page Speed Insights API key or the script will not work
//Click File -> Project Properties
//In the 'Script properties' tab click 'add row'
//For property name add PSI_API_KEY
//For the value paste in your API key and click save
//You should now be good to setup triggers to schedule the execution of your script

//Constants you may like to update
//Switch to control whether to log all third party scripts per page and their blocking time etc. Creates many rows and can fill spreadsheet limits quickly 'TRUE'/'FALSE'
var TRACK_THIRD_PARTY_SCRIPTS = "TRUE";
//In in order to prevent the Google sheet reaching its data limit, we collect third party script data once a week and not daily. You can choose the day of week to collect this data below
//Three letter abbreviation of day of week to collect third party scripts if enabled above, use 'Mon, 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' or 'Sun'.
var THIRD_PARTY_SCRIPTS_DOW = "Mon";

//Constants that you shouldn't need to update
//These are the tab names from the Google Sheets PSI spreadsheet, if you change the tab names then update them below 
//Source URLs tab name
var SOURCE_URL_TAB = "SourceURLs";
//Results tab name
var RESULTS_V5_TAB = "Results API v5";
//Third Party resource results tab name
var THIRD_PARTY_RESULTS_TAB = "Third party resources";
//Origin level Chrome User Experience Report data tab name
var ORIGIN_DATA_TAB = "Origin CRUX data";
//Tab to save erros and help trouble shoot
var ERROR_LOG = "Error log";


//The main script follows below, you shouldn't need to change anything in this part at all
var scriptProperties = PropertiesService.getScriptProperties();
var pageSpeedApiKey = scriptProperties.getProperty('PSI_API_KEY');
var pageSpeedMonitorUrls = [];
var spreadsheet;
var originArray = [];

function monitorV5() {
  console.log("starting");
  getTestURLs();
  for (var i = 0; i < pageSpeedMonitorUrls.length; i++) {
    var url = pageSpeedMonitorUrls[i];
    var desktop = callPageSpeed(url, 'desktop');
    var mobile = callPageSpeed(url, 'mobile');
    if((desktop.error)||(mobile.error)) {
      //do nothing
    } else {
      //Setup to gracefully handle missing parts of PSI response
      var desktopParsedData = "EMPTY";
      var mobileParsedData = "EMPTY";
      try {
        desktopParsedData = new parsedResults(desktop);
      } catch(e) {
        console.log("Error present in desktop PSI response, couldn't parse data. Error reported is: " + e);
        console.log("Logging full error to Gdoc spreadsheet tab: " + ERROR_LOG);
        logToErrorSheet(url, "desktop", desktop);
      }
      try {
        mobileParsedData = new parsedResults(mobile);
      } catch(e) {
        console.log("Error present in mobile PSI response, couldn't parse data. Error reported is: " + e);
        console.log("Logging full error to Gdoc spreadsheet tab: " + ERROR_LOG);
        logToErrorSheet(url, "mobile", mobile);
      }
      if ((desktopParsedData != "EMPTY")&&(mobileParsedData != "EMPTY")) {
        addRow(url, desktop, mobile, desktopParsedData, mobileParsedData);
        writeThirdPartyResourceRows(url, mobile);
        addOriginData(desktop, mobile);
      } else {
        console.log("Skipping writing data for " + pageSpeedMonitorUrls[i] + " due to an error in PSI response");
      }
    }
  }
}

function getTestURLs() {
  spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(SOURCE_URL_TAB);
  sourceURLs = sheet.getDataRange().getValues();
  for (var i=0; i < sourceURLs.length; i++) {
    pageSpeedMonitorUrls[i] = sourceURLs[i][0];
  }
}

function callPageSpeed(url, strategy) {
  var pageSpeedUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + url + '&key=' + pageSpeedApiKey + '&strategy=' + strategy;
  var response;
  var maxAttempts = 3
  var attempt;
  var errored = "FALSE";
  for (attempt = 0; attempt < maxAttempts; attempt++) {
      console.log("Attempt number " + (attempt + 1) + " requesting " + url + " with deviceType of " + strategy);
      try {
        response = UrlFetchApp.fetch(pageSpeedUrl,{
          "escaping": false,
          "muteHttpExceptions": true
          }
        );
        
        if(response.getResponseCode() == 200){
        console.log("Attempt number " + (attempt + 1) +" was successful");
        break;
        }
        
        else {
          console.log("Attempt number " + (attempt + 1) +" was unsuccessful, response code is: " + response.getResponseCode());
          if(attempt == 2){
            errored = "TRUE";
          }
        }
        
      } catch (e) {
        console.log("An error has occured during attempt "+ (attempt + 1) + " : "+ e);
        if(attempt == 2){
            errored = "TRUE";
        }
      }
  }
  if(errored == "TRUE"){
    return "ERROR";
  } else {
    var json = response.getContentText();
    return JSON.parse(json);
  }
}

function parsedResults(data) {
  var resultsArray = data.lighthouseResult.audits['network-requests'].details.items;
  this.htmlPrimaryDocSize = resultsArray[0].transferSize;
  this.documentResources = 0;
  this.documentResourceBytes = 0;
  this.scriptResources = 0;
  this.scriptResourceBytes = 0;
  this.stylesheetResources = 0;
  this.stylesheetResourceBytes = 0;
  this.imageResources = 0;
  this.imageResourceBytes = 0;
  this.fontResources = 0;
  this.fontResourceBytes = 0;
  this.otherResources = 0;
  this.otherResourceBytes = 0;
  var i;
  for(i = 0; i < resultsArray.length; i++) {
    if (resultsArray[i].resourceType === "Document") {
      this.documentResources += 1;
      this.documentResourceBytes += resultsArray[i].transferSize;
    } else if (resultsArray[i].resourceType === "Script") {
      this.scriptResources += 1;
      this.scriptResourceBytes += resultsArray[i].transferSize;
    } else if (resultsArray[i].resourceType === "Stylesheet") {
      this.stylesheetResources += 1;
      this.stylesheetResourceBytes += resultsArray[i].transferSize;
    } else if (resultsArray[i].resourceType === "Image") {
      this.imageResources += 1;
      this.imageResourceBytes += resultsArray[i].transferSize;
    } else if (resultsArray[i].resourceType === "Font") {
      this.fontResources += 1;
      this.fontResourceBytes += resultsArray[i].transferSize;
    } else {
      this.otherResources += 1;
      this.otherResourceBytes += resultsArray[i].transferSize;
    }
  }
  this.parseHTMLTime = 0;
  this.scriptParseCompileTime = 0;
  this.scriptEvaluationTime = 0;
  this.styleLayoutTime = 0;
  this.paintCompositeRenderTime = 0;
  this.garbageCollectionTime = 0;
  this.otherTime = 0;
  var mainThreadWork = data.lighthouseResult.audits['mainthread-work-breakdown'].details.items;
  var j;
  for (j = 0; j < mainThreadWork.length; j++) {
    if (mainThreadWork[j].group === "parseHTML") {
      this.parseHTMLTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "scriptParseCompile") {
      this.scriptParseCompileTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "scriptEvaluation") {
      this.scriptEvaluationTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "styleLayout") {
      this.styleLayoutTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "paintCompositeRender") {
      this.paintCompositeRenderTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "garbageCollection") {
      this.garbageCollectionTime = mainThreadWork[j].duration;
    } else if (mainThreadWork[j].group === "other") {
      this.otherTime = mainThreadWork[j].duration;
    }
  }
}

function addRow(url, desktop, mobile, desktopParsedData, mobileParsedData) {
  var sheet = spreadsheet.getSheetByName(RESULTS_V5_TAB);
  sheet.appendRow([
    Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'),
    url,
    checkForCruxData(url, desktop),
    getPercentileFCP(desktop),
    getFastFCP(desktop),
    getMediumFCP(desktop),
    getSlowFCP(desktop),
    getFCPCategory(desktop),
    getPercentileFID(desktop),
    getFastFID(desktop),
    getMediumFID(desktop),
    getSlowFID(desktop),
    getFIDCategory(desktop),
    getPercentileCLS(desktop),
    getFastCLS(desktop),
    getMediumCLS(desktop),
    getSlowCLS(desktop),
    getCLSCategory(desktop),
    getPercentileLCP(desktop),
    getFastLCP(desktop),
    getMediumLCP(desktop),
    getSlowLCP(desktop),
    getLCPCategory(desktop),
    getResponseCode(desktop),
    getSpeedIndexScore(desktop),
    getLighthousePerformanceScore(desktop),
    getFirstContentfulPaint(desktop),
    getFirstMeaningfulPaint(desktop),
    getFirstCPUIdle(desktop),
    getInteractive(desktop),
    getEstimatedInputLatency(desktop),
    getTimeToFirstByte(desktop),    
    getLargestContentfulPaint(desktop),
    getTotalBlockingTime(desktop),
    getCumulativeLayoutShift(desktop),    
    getHtmlPrimaryDocSize(desktopParsedData),
    getDocumentResources(desktopParsedData),
    getDocumentResourceBytes(desktopParsedData),
    getScriptResources(desktopParsedData),
    getScriptResourceBytes(desktopParsedData),
    getStylesheetResources(desktopParsedData),
    getStylesheetResourceBytes(desktopParsedData),
    getImageResources(desktopParsedData),
    getImageResourceBytes(desktopParsedData),
    getFontResources(desktopParsedData),
    getFontResourceBytes(desktopParsedData),
    getOtherResources(desktopParsedData),
    getOtherResourceBytes(desktopParsedData),
    getParseHTMLTime(desktopParsedData),
    getScriptParseCompileTime(desktopParsedData),
    getScriptEvaluationTime(desktopParsedData),
    getStyleLayoutTime(desktopParsedData),
    getPaintCompositeRenderTime(desktopParsedData),
    getGarbageCollectionTime(desktopParsedData),
    getOtherTime(desktopParsedData),
    checkForCruxData(url, mobile),
    getPercentileFCP(mobile),
    getFastFCP(mobile),
    getMediumFCP(mobile),
    getSlowFCP(mobile),
    getFCPCategory(mobile),
    getPercentileFID(mobile),
    getFastFID(mobile),
    getMediumFID(mobile),
    getSlowFID(mobile),
    getFIDCategory(mobile),
    getPercentileCLS(mobile),
    getFastCLS(mobile),
    getMediumCLS(mobile),
    getSlowCLS(mobile),
    getCLSCategory(mobile),
    getPercentileLCP(mobile),
    getFastLCP(mobile),
    getMediumLCP(mobile),
    getSlowLCP(mobile),
    getLCPCategory(mobile),
    getResponseCode(mobile),
    getSpeedIndexScore(mobile),
    getLighthousePerformanceScore(mobile),
    getFirstContentfulPaint(mobile),
    getFirstMeaningfulPaint(mobile),
    getFirstCPUIdle(mobile),
    getInteractive(mobile),
    getEstimatedInputLatency(mobile),
    getTimeToFirstByte(mobile),
    getLargestContentfulPaint(mobile),
    getTotalBlockingTime(mobile),
    getCumulativeLayoutShift(mobile),
    getHtmlPrimaryDocSize(mobileParsedData),
    getDocumentResources(mobileParsedData),
    getDocumentResourceBytes(mobileParsedData),
    getScriptResources(mobileParsedData),
    getScriptResourceBytes(mobileParsedData),
    getStylesheetResources(mobileParsedData),
    getStylesheetResourceBytes(mobileParsedData),
    getImageResources(mobileParsedData),
    getImageResourceBytes(mobileParsedData),
    getFontResources(mobileParsedData),
    getFontResourceBytes(mobileParsedData),
    getOtherResources(mobileParsedData),
    getOtherResourceBytes(mobileParsedData),
    getParseHTMLTime(mobileParsedData),
    getScriptParseCompileTime(mobileParsedData),
    getScriptEvaluationTime(mobileParsedData),
    getStyleLayoutTime(mobileParsedData),
    getPaintCompositeRenderTime(mobileParsedData),
    getGarbageCollectionTime(mobileParsedData),
    getOtherTime(mobileParsedData)
  ]);
}

function checkForCruxData(url, data) {
  if (typeof data.loadingExperience.id === 'undefined')  {
    return "N/A";
  } else if (data.loadingExperience.id == url) {
    return "page";
  } else {
    return "domain";
  }
}

function getPercentileFCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.percentile;
  } else {
    return "N/A";
  }
}

function getFastFCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[0].proportion;
  } else {
    return "N/A";
  }
}

function getMediumFCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[1].proportion;
  } else{
    return "N/A";
  }
}

function getSlowFCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[2].proportion;
  } else {
    return "N/A";
  }
}

function getFCPCategory(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.category;
  } else {
    return "N/A";
  }
}


function getPercentileFID(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_INPUT_DELAY_MS.percentile;
  } else {
    return "N/A";
  }
}

function getFastFID(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[0].proportion;
  } else {
    return "N/A";
  }
}

function getMediumFID(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[1].proportion;
  } else {
    return "N/A";
  }
}

function getSlowFID(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[2].proportion;
  } else {
    return "N/A";
  }
}

function getFIDCategory(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.FIRST_INPUT_DELAY_MS.category;
  } else {
    return "N/A";
  }
}

function getPercentileCLS(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100;
  } else {
    return "N/A";
  }
}

function getFastCLS(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[0].proportion;
  } else {
    return "N/A";
  }
}

function getMediumCLS(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[1].proportion;
  } else {
    return "N/A";
  }
}

function getSlowCLS(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[2].proportion;
  } else {
    return "N/A";
  }
}

function getCLSCategory(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category;
  } else {
    return "N/A";
  }
}

function getPercentileLCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile;
  } else {
    return "N/A";
  }
}

function getFastLCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[0].proportion;
  } else {
    return "N/A";
  }
}

function getMediumLCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[1].proportion;
  } else {
    return "N/A";
  }
}

function getSlowLCP(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[2].proportion;
  } else {
    return "N/A";
  }
}

function getLCPCategory(data) {
  if(data.loadingExperience.metrics) {
    return data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.category;
  } else {
    return "N/A";
  }
}

function getResponseCode(data) {
  return data.lighthouseResult.audits['network-requests'].details.items[0].statusCode;
}

function getSpeedIndexScore(data) {
  return data.lighthouseResult.audits.metrics.details.items[0].speedIndex;
}
  
function getLighthousePerformanceScore(data) {
  return data.lighthouseResult.categories.performance.score;
}

function getFirstContentfulPaint(data) {
    return data.lighthouseResult.audits.metrics.details.items[0].firstContentfulPaint;
}
  
function getFirstMeaningfulPaint(data){
    return data.lighthouseResult.audits.metrics.details.items[0].firstMeaningfulPaint;
}
  
function getFirstCPUIdle(data){
    return data.lighthouseResult.audits.metrics.details.items[0].firstCPUIdle;
}
  
function getInteractive(data){
    return data.lighthouseResult.audits.metrics.details.items[0].interactive;
}
  
function getEstimatedInputLatency(data){
    return data.lighthouseResult.audits.metrics.details.items[0].estimatedInputLatency;
}

function getLargestContentfulPaint(data){
  return data.lighthouseResult.audits.metrics.details.items[0].largestContentfulPaint;
}

function getTotalBlockingTime(data){
  return data.lighthouseResult.audits.metrics.details.items[0].totalBlockingTime;
}

function getCumulativeLayoutShift(data){
  return data.lighthouseResult.audits.metrics.details.items[0].cumulativeLayoutShift;
}
  
function getTimeToFirstByte(data){
    return data.lighthouseResult.audits['network-requests'].details.items[0].endTime;
}

function getHtmlPrimaryDocSize(data) {
    return data.htmlPrimaryDocSize;
}
function getDocumentResources(data) {
    return data.documentResources;
}
  
function getDocumentResourceBytes(data) {
    return data.documentResourceBytes;
}
  
function getScriptResources(data) {
    return data.scriptResources;
}
  
function getScriptResourceBytes(data) {
    return data.scriptResourceBytes;
}
  
function getStylesheetResources(data) {
    return data.stylesheetResources;
}
  
function getStylesheetResourceBytes(data) {
    return data.stylesheetResourceBytes;
}
  
function getImageResources(data) {
    return data.imageResources;
}
  
function getImageResourceBytes(data) {
    return data.imageResourceBytes;
}
  
function getFontResources(data) {
    return data.fontResources;
}
  
function getFontResourceBytes(data) {
    return data.fontResourceBytes;
}
  
function getOtherResources(data) {
    return data.otherResources;
}
  
function getOtherResourceBytes(data) {
    return data.otherResourceBytes;
}
  
function getParseHTMLTime(data) {
    return data.parseHTMLTime;
}
  
function getScriptParseCompileTime(data) {
    return data.scriptParseCompileTime;
}
  
function getScriptEvaluationTime(data) {
    return data.scriptEvaluationTime;
}
  
function getStyleLayoutTime(data) {
    return data.styleLayoutTime;
}
  
function getPaintCompositeRenderTime(data) {
    return data.paintCompositeRenderTime;
}
  
function getGarbageCollectionTime(data) {
    return data.garbageCollectionTime;
}
  
function getOtherTime(data) {
    return data.otherTime;
}

function writeThirdPartyResourceRows(url, mobile) {
  if(TRACK_THIRD_PARTY_SCRIPTS== "FALSE") {
    console.log("Third party script tracking is disabled");
    return;
  } else if (Utilities.formatDate(new Date(), "GMT", "E") != THIRD_PARTY_SCRIPTS_DOW) {
    console.log("Third party script tracking is enabled, but not set to run today");
    return;
  }
  console.log("Writing third party resource rows");
  var items = mobile.lighthouseResult.audits['third-party-summary'].details.items;
  var date = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
  var thirdPartySheet = spreadsheet.getSheetByName(THIRD_PARTY_RESULTS_TAB);
  
  var x;
  var type;
  var text;
  var resourceUrl;
  var mainThreadTime;
  var transferSize;
  var blockingTime;
  
  for (x = 0; x < items.length; x++) {
  
    if (items[x].entity.type) {
      type = items[x].entity.type;
    } else {
      type = "";
    }
    
    if (items[x].entity.text) {
      text = items[x].entity.text;
    } else {
      text = "";
    }
    
    if (items[x].entity.url) {
      resourceUrl = items[x].entity.url;
    } else {
      resourceUrl = "";
    }
    
    if (items[x].mainThreadTime) {
      mainThreadTime = items[x].mainThreadTime;
    } else {
      mainThreadTime = "";
    }
    
    if (items[x].transferSize) {
      transferSize = items[x].transferSize;
    } else {
      transferSize = "";
    }
    
    if (items[x].blockingTime) {
      blockingTime = items[x].blockingTime;
    } else {
      blockingTime = "";
    }
    
    thirdPartySheet.appendRow([
    date,
    url,
    text,
    resourceUrl,
    type,
    transferSize,
    mainThreadTime,
    blockingTime])
  }
}

function logToErrorSheet (url, strategy, obj) {
  var sheet = spreadsheet.getSheetByName(ERROR_LOG);
  sheet.appendRow([
          Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'),
          url,
          strategy,
          JSON.stringify(obj)]);
}

function addOriginData (desktopData, mobileData) {
  //Checks if this Origin has already had its data added to spreadsheet
  //Adds data to spreadsheet if not already captured, otherwise skips it
  console.log("Checking if origin data has been added...");
  if (!desktopData.originLoadingExperience) {
    console.log("No CRUX data present for this domain so skip it");
    return;
  }
  const found = originArray.some(function(el) { return el === desktopData.originLoadingExperience.id });
  
  if (!found) {
    console.log("Origin data not yet added for the domain: " + desktopData.originLoadingExperience.id);
    originArray.push(desktopData.originLoadingExperience.id);
    var sheet = spreadsheet.getSheetByName(ORIGIN_DATA_TAB);
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'),
      (desktopData.originLoadingExperience.id + "/"),
      desktopData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.percentile,
      desktopData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[0].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[1].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[2].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.category,
      
      desktopData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.percentile,
      desktopData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[0].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[1].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[2].proportion,
      desktopData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.category,
      
      desktopData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile,
      desktopData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[0].proportion,
      desktopData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[1].proportion,
      desktopData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[2].proportion,
      desktopData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category,
      
      desktopData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile,
      desktopData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[0].proportion,
      desktopData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[1].proportion,
      desktopData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[2].proportion,
      desktopData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.category,
      
      mobileData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.percentile,
      mobileData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[0].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[1].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.distributions[2].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS.category,
      
      mobileData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.percentile,
      mobileData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[0].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[1].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.distributions[2].proportion,
      mobileData.originLoadingExperience.metrics.FIRST_INPUT_DELAY_MS.category,
      
      mobileData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile,
      mobileData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[0].proportion,
      mobileData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[1].proportion,
      mobileData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.distributions[2].proportion,
      mobileData.originLoadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.category,
      
      mobileData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile,
      mobileData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[0].proportion,
      mobileData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[1].proportion,
      mobileData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.distributions[2].proportion,
      mobileData.originLoadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.category
      ])
  } else {
    
    //Origin data already added to spreadsheet
    console.log("Origin data has been previously added for the domain:" + desktopData.originLoadingExperience.id);
  }
}
