/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

var ADJUSTMENT_ACCOUNT = '400';

var BACON_GREASE = '2762';

var BACON_COOKED = '2761';


var SPARAM_INDEX = 'custscript_devma_loop_index';


define(['N/runtime', 'N/record', 'N/search', 'N/task', 'N/runtime', 'N/format'],
    function (runtime, record, search, task, runtime, format) {
        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */

        /**
          * Reschedules the current script and returns the ID of the reschedule task
          */
        function rescheduleCurrentScript(paramobj) {
            var scheduledScriptTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT
            });
            scheduledScriptTask.scriptId = runtime.getCurrentScript().id;
            scheduledScriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
            scheduledScriptTask.params = paramobj;
            scheduledScriptTask.submit();
        }


        function execute(scriptContext) {
            var scriptObj = runtime.getCurrentScript();
            var index = scriptObj.getParameter({ name: SPARAM_INDEX });
            if (index == null || index == '')
                index = 0;

            var filterForSearch =
                [
                    ["type", "anyof", "WOClose"],
                    "AND",
                    ["custbody_devma_bacon_adjustment_create", "is", "F"],
                    "AND",
                    ["datecreated", "within", "today"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["item", "anyof", "2759", "2760"]
                ]
            var cols =
                [
                    search.createColumn({ name: "tranid", label: "Document Number" }),
                    search.createColumn({ name: "datecreated", label: "Date Created" }),
                    search.createColumn({ name: "trandate", label: "Date" }),
                    search.createColumn({ name: "internalid", label: "Internal ID" }),
                    search.createColumn({ name: "item", label: "Item" }),
                    search.createColumn({ name: "createdfrom", label: "Created From" }),
                    search.createColumn({ name: "custbody_devma_bacon_adjustment_create", label: "Bacon Adjustment Created" })
                ]
            var searchResults = getSearchResults('transaction', filterForSearch, cols)

            if (searchResults != null && searchResults != '') {
                var count = 0;
                log.debug('searchResults Length', searchResults.length);
                var columns = searchResults[0].columns;
                for (var s = index; s < searchResults.length; s++) {
                    try {
                        var result = searchResults[s];
                        var recId = searchResults[s].id;
                        var recType = 'workorderclose';
                        var createdfromId = result.getValue('createdfrom')
                        var baconCreated = result.getValue('custbody_devma_bacon_adjustment_create')
                        var dateCreated = result.getValue('datecreated')
                        var item = result.getValue('item')
                        var closeID = result.getValue('tranid')
                        var dateCreated = format.parse({
                            value: dateCreated,
                            type: format.Type.DATETIME
                        });
                        log.debug('dateCreated', dateCreated)
                        // Get the current date and time
                        var currentDate = new Date();
                        log.debug('currentDate', currentDate)
                        // Calculate the difference in milliseconds
                        var timeDifference = currentDate - dateCreated;

                        // Convert the difference to minutes
                        var differenceInMinutes = Math.floor(timeDifference / (1000 * 60));
                        log.debug('differenceInMinutes', differenceInMinutes)
                        if (differenceInMinutes >= 90) {
                            var BACON_ITEM = '';
                            if ((item == '2759' || item == '2760') && (baconCreated == false)) {
                                BACON_ITEM = item;
                                log.debug('createdfromId', createdfromId)
                                var woRec = record.load({ type: 'workorder', id: createdfromId, isDynamic: true });
                                var woNumber = woRec.getValue('tranid')
                                var lineCount = woRec.getLineCount({ sublistId: 'links' });
                                var woCompletionID = ''
                                for (var i = 0; i < lineCount; i++) {
                                    var type = woRec.getSublistValue({ sublistId: 'links', fieldId: 'type', line: i })
                                    var id = woRec.getSublistValue({ sublistId: 'links', fieldId: 'id', line: i })
                                    if (type == 'Work Order Completion') {
                                        woCompletionID = id;
                                        break;
                                    }
                                }
                                log.debug('woCompletionID', woCompletionID)
                                if (woCompletionID != null && woCompletionID != '') {
                                    var currRec = record.load({ type: 'workordercompletion', id: woCompletionID, isDynamic: true });
                                    var date = currRec.getValue('trandate')
                                    var subsId = currRec.getValue('subsidiary')
                                    var adjsLoc = currRec.getValue('location')
                                    var wocAssembly = currRec.getValue('item')
                                    var wocQTY = currRec.getValue('completedquantity')
                                    var baconGreaseQty = currRec.getValue('custbodyppfc_grease_yield')
                                    //var baconCookedQty = currRec.getValue('custbodyppfc_bacon_yield') 
                                    var baconCookedQty = currRec.getValue('custbodyppfc_bacon_yield2')
                                    var WO_completionID = currRec.getValue('tranid')
                                    log.debug('wocQTY', wocQTY)
                                    log.debug('date', date)
                                    log.debug('baconCookedQty', baconCookedQty)
                                    if (BACON_ITEM == wocAssembly) {
                                        var greaseDate = new Date(date)
                                        greaseDate.setDate(greaseDate.getDate() + 90);
                                        var cookedDate = new Date(date)
                                        cookedDate.setDate(cookedDate.getDate() + 6);
                                        log.debug('greaseDate', greaseDate);
                                        log.debug('cookedDate', cookedDate);
                                        var baconItemRec = record.load({ type: 'lotnumberedassemblyitem', id: BACON_ITEM });
                                        var baconItemLot = baconItemRec.getValue('itemid')
                                        var greaseItemRec = record.load({ type: 'lotnumberedassemblyitem', id: BACON_GREASE });
                                        var greaseItemLot = greaseItemRec.getValue('itemid')
                                        var cookedItemRec = record.load({ type: 'lotnumberedassemblyitem', id: BACON_COOKED });
                                        var cookedItemLot = cookedItemRec.getValue('itemid')

                                        var binNumber = '';
                                        var lotNumber = '';
                                        var inventoryDetailRecordObj = currRec.getSubrecord({
                                            fieldId: 'inventorydetail'
                                        });
                                        log.debug('inventoryDetailRecordObj', inventoryDetailRecordObj);

                                        if (inventoryDetailRecordObj != null && inventoryDetailRecordObj != '') {
                                            var subRecordLineCount = inventoryDetailRecordObj.getLineCount({ sublistId: 'inventoryassignment' });
                                            log.debug('subRecordLineCount', subRecordLineCount);
                                            for (var j = 0; j < subRecordLineCount; j++) {
                                                binNumber = inventoryDetailRecordObj.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', line: j });
                                                lotNumber = inventoryDetailRecordObj.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'numberedrecordid', line: j });

                                                break;

                                            }
                                        }

                                        var julianDate = toJulianDate(date);
                                        var today = new Date(); // Get the current date
                                        var year = today.getFullYear(); // Extract the year from the date
                                        if (isLeapYear(year)) {
                                            julianDate = Number(julianDate) + Number(1)
                                        }
                                        log.debug('Julian Date', julianDate);
                                        log.debug('Current binNumber', binNumber);
                                        log.debug('Current lotNumber', lotNumber);
                                        //log.debug('BACON_ITEM', BACON_ITEM);

                                        var baconAvgCost = fetchAverageCost(BACON_ITEM)
                                        if (baconAvgCost == null || baconAvgCost == '')
                                            baconAvgCost = 0;
                                        baconAvgCost = parseFloat(baconAvgCost).toFixed(2);
                                        log.debug('baconAvgCost', baconAvgCost);

                                        var greaseAvgCost = fetchAverageCost(BACON_GREASE)
                                        if (greaseAvgCost == null || greaseAvgCost == '')
                                            greaseAvgCost = 0;
                                        greaseAvgCost = parseFloat(greaseAvgCost).toFixed(2);
                                        log.debug('greaseAvgCost', greaseAvgCost);

                                        if (baconGreaseQty == null || baconGreaseQty == '')
                                            baconGreaseQty = 0;
                                        if (baconCookedQty == null || baconCookedQty == '')
                                            baconCookedQty = 0;

                                        var cookedBackonUnitCost = 0;
                                        cookedBackonUnitCost = parseFloat(parseFloat(parseFloat(wocQTY) * parseFloat(baconAvgCost)) - parseFloat(parseFloat(baconGreaseQty) * parseFloat(greaseAvgCost))) / parseFloat(baconCookedQty)
                                        if (cookedBackonUnitCost == null || cookedBackonUnitCost == '')
                                            cookedBackonUnitCost = 0;
                                        cookedBackonUnitCost = parseFloat(cookedBackonUnitCost).toFixed(2);
                                        if (cookedBackonUnitCost == 'Infinity' || cookedBackonUnitCost == 'NaN')
                                            cookedBackonUnitCost = 0;
                                        log.debug('cookedBackonUnitCost', cookedBackonUnitCost);
                                        // if(cookedBackonUnitCost < 0)
                                        // cookedBackonUnitCost = cookedBackonUnitCost * -1

                                        var inventoryAdjustment = record.create({
                                            type: record.Type.INVENTORY_ADJUSTMENT,
                                            isDynamic: true
                                        });

                                        // Set main fields
                                        inventoryAdjustment.setValue({
                                            fieldId: 'subsidiary',
                                            value: subsId // Replace with your subsidiary ID
                                        });

                                        inventoryAdjustment.setValue({
                                            fieldId: 'account',
                                            value: ADJUSTMENT_ACCOUNT
                                        });
                                        inventoryAdjustment.setValue({
                                            fieldId: 'adjlocation',
                                            value: adjsLoc
                                        });
                                        inventoryAdjustment.setValue({
                                            fieldId: 'trandate',
                                            value: date
                                        });
                                        inventoryAdjustment.setValue({
                                            fieldId: 'memo',
                                            value: "Bacon Adjustment: WO Completion ID " + WO_completionID
                                        });
                                        inventoryAdjustment.setValue({
                                            fieldId: 'custbody_devma_ai_reason',
                                            value: '7'
                                        });


                                        // Add an item
                                        inventoryAdjustment.selectNewLine({
                                            sublistId: 'inventory'
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'item',
                                            value: BACON_ITEM
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'location',
                                            value: adjsLoc
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'adjustqtyby',
                                            value: wocQTY * -1// Quantity to adjust by
                                        });

                                        // Create inventory detail subrecord
                                        var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                                            sublistId: 'inventory',
                                            fieldId: 'inventorydetail'
                                        });

                                        inventoryDetail.selectNewLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'issueinventorynumber',
                                            value: lotNumber
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'quantity',
                                            value: wocQTY * -1 // Quantity for this assignment
                                        });
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'expirationdate',
                                            value: date
                                        });

                                        // Set status (assuming 'status' is a valid field in your inventory assignment)
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'inventorystatus',
                                            value: 1 // Replace with your status ID
                                        });

                                        inventoryDetail.commitLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        // Commit the item line
                                        inventoryAdjustment.commitLine({
                                            sublistId: 'inventory'
                                        });

                                        // Add item #2
                                        inventoryAdjustment.selectNewLine({
                                            sublistId: 'inventory'
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'item',
                                            value: BACON_GREASE
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'location',
                                            value: adjsLoc
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'adjustqtyby',
                                            value: baconGreaseQty // Quantity to adjust by
                                        });

                                        // Create inventory detail subrecord
                                        var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                                            sublistId: 'inventory',
                                            fieldId: 'inventorydetail'
                                        });

                                        inventoryDetail.selectNewLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'receiptinventorynumber',
                                            value: woNumber + ' ' + '1048'
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'quantity',
                                            value: baconGreaseQty // Quantity for this assignment
                                        });
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'binnumber',
                                            value: binNumber // Bin for this assignment
                                        });
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'expirationdate',
                                            value: greaseDate
                                        });

                                        // Set status (assuming 'status' is a valid field in your inventory assignment)
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'inventorystatus',
                                            value: 1 // Replace with your status ID
                                        });

                                        inventoryDetail.commitLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        // Commit the item line
                                        inventoryAdjustment.commitLine({
                                            sublistId: 'inventory'
                                        });


                                        // Add item #3
                                        inventoryAdjustment.selectNewLine({
                                            sublistId: 'inventory'
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'item',
                                            value: BACON_COOKED
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'location',
                                            value: adjsLoc
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'adjustqtyby',
                                            value: baconCookedQty
                                        });

                                        inventoryAdjustment.setCurrentSublistValue({
                                            sublistId: 'inventory',
                                            fieldId: 'unitcost',
                                            value: cookedBackonUnitCost
                                        });

                                        // Create inventory detail subrecord
                                        var inventoryDetail = inventoryAdjustment.getCurrentSublistSubrecord({
                                            sublistId: 'inventory',
                                            fieldId: 'inventorydetail'
                                        });

                                        inventoryDetail.selectNewLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'receiptinventorynumber',
                                            value: woNumber + ' ' + '1047'
                                        });

                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'quantity',
                                            value: baconCookedQty // Quantity for this assignment
                                        });
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'binnumber',
                                            value: binNumber // Bin for this assignment
                                        });
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'expirationdate',
                                            value: cookedDate
                                        });

                                        // Set status (assuming 'status' is a valid field in your inventory assignment)
                                        inventoryDetail.setCurrentSublistValue({
                                            sublistId: 'inventoryassignment',
                                            fieldId: 'inventorystatus',
                                            value: 1 // Replace with your status ID
                                        });

                                        inventoryDetail.commitLine({
                                            sublistId: 'inventoryassignment'
                                        });

                                        // Commit the item line
                                        inventoryAdjustment.commitLine({
                                            sublistId: 'inventory'
                                        });

                                        // Save the record
                                        var recordId = inventoryAdjustment.save();
                                        log.debug('Inventory Adjustment Created', 'Record ID: ' + recordId);
                                        if (recordId != '' && recordId != null) {
                                            record.submitFields({
                                                type: recType,
                                                id: recId,
                                                values: {
                                                    custbody_devma_bacon_adjustment_create: true
                                                },
                                                options: {
                                                    enableSourcing: false,
                                                    ignoreMandatoryFields: true
                                                }
                                            });
                                            record.submitFields({
                                                type: 'workordercompletion',
                                                id: woCompletionID,
                                                values: {
                                                    custbody_devma_bacon_adjustment_create: true
                                                },
                                                options: {
                                                    enableSourcing: false,
                                                    ignoreMandatoryFields: true
                                                }
                                            });

                                        }


                                    }
                                }


                            }

                        }

                    } catch (e) {
                        log.debug('error', e.message + ' WO Close ID: ' + recId)
                    }
                    if (runtime.getCurrentScript().getRemainingUsage() < 500) {
                        var paramobj = {};
                        paramobj[SPARAM_INDEX] = parseInt(s) + 1;
                        rescheduleCurrentScript(paramobj);
                        break;
                    }
                }//end of main loop


            }


        }

        return {
            execute: execute
        };

        function getSearchResults(rectype, fils, cols) {
            var mySearch = search.create({
                type: rectype,
                columns: cols,
                filters: fils
            });
            var resultsList = [];
            var myPagedData = mySearch.runPaged({ pageSize: 1000 });
            myPagedData.pageRanges.forEach(function (pageRange) {
                var myPage = myPagedData.fetch({ index: pageRange.index });
                myPage.data.forEach(function (result) {
                    resultsList.push(result);
                });
            });
            return resultsList;
        }
        function fetchAverageCost(item) {
            var itemFilts = []
            itemFilts.push({ name: 'internalid', operator: 'anyof', values: [item] });
            var itemCols = []
            itemCols.push(search.createColumn({ name: 'averagecost' }));

            var avgCost = 0;
            var itemSearchResult = getSearchResults('item', itemFilts, itemCols)
            if (itemSearchResult != null && itemSearchResult != '') {
                avgCost = itemSearchResult[0].getValue('averagecost');
            }
            return avgCost;
        }
        function getSearchResults(rectype, fils, cols) {
            var mySearch = search.create({
                type: rectype,
                columns: cols,
                filters: fils
            });
            var resultsList = [];
            var myPagedData = mySearch.runPaged({ pageSize: 1000 });
            myPagedData.pageRanges.forEach(function (pageRange) {
                var myPage = myPagedData.fetch({ index: pageRange.index });
                myPage.data.forEach(function (result) {
                    resultsList.push(result);
                });
            });
            return resultsList;
        }
        function toJulianDate(date) {
            // Ensure the input is a Date object
            date = new Date(date);

            // Get full year and last two digits
            var fullYear = date.getFullYear();
            var year = fullYear % 100; // Last two digits

            // Calculate the day of the year
            var start = new Date(fullYear, 0, 0);
            var diff = date - start;
            var oneDay = 1000 * 60 * 60 * 24;
            var dayOfYear = Math.floor(diff / oneDay);

            // Pad day of the year with leading zeros if necessary
            var dayOfYearPadded = customPadStart(String(dayOfYear), 3, '0');
            var julineString = year + dayOfYearPadded;

            return julineString;
        }
        /**
        * Custom padStart function for SuiteScript
        * @param {string} str - The original string.
        * @param {number} targetLength - The length of the resulting string after padding.
        * @param {string} padString - The string to pad with.
        * @returns {string} - The padded string.
        */
        function customPadStart(str, targetLength, padString) {
            str = String(str);
            if (str.length >= targetLength) {
                return str;
            }
            padString = String(padString || ' ');
            while (str.length < targetLength) {
                str = padString + str;
            }
            return str.slice(-targetLength);
        }
        function isLeapYear(year) {
            return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
        }
    });