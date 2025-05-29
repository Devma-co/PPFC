/**
 * Custom GL Plugin - PPFC
 * Author - Nazish
 * Date - 8th Oct 2024
 * This script adjusts the GL impact of an Item Fulfillment when certain conditions are met.
 * 
 * Requirements:
 * - Customer must be "CUST10990 PPFC - Internal use only" (ID: 3767)
 * - Free Product Category is not empty
 * - Status of the Item Fulfillment is "Shipped"
 * 
 * The script will reverse any GL lines hitting COGS or Expense accounts and reclassify based on the Free Product Category.
 */

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {
    try {
        var customer = transactionRecord.getFieldValue('entity');
        nlapiLogExecution('debug', 'customer', customer);
        var productCategory = transactionRecord.getFieldText('custbodyfree_product_category');
        nlapiLogExecution('debug', 'productCategory', productCategory);
        var shipstatus = transactionRecord.getFieldValue('shipstatus');
       var headerMemo = transactionRecord.getFieldValue('memo');
        nlapiLogExecution('debug', 'shipstatus', shipstatus);

        // Only process if customer is "CUST10990 PPFC" and status is Shipped
        if (customer === '3767' && productCategory && shipstatus === 'C') {
            nlapiLogExecution('debug', 'inside condition true', '');
            var categoryMapping = {
                'Sales Support': 408,        // Other Sales Expense
                'Brokers': 408,             // Other Sales Expense
                'Customer Demos': 416,      // Other Marketing Expense
                'Distributors': 408,        // Other Sales Expense
                'Donations': 452,           // Charitable Donations
                'Public Relations': 412,    // Public Relations
                'R&D': 464                  // Other R&D Expenses
            };

            var mappedAccount = categoryMapping[productCategory];
            nlapiLogExecution('debug', 'mappedAccount', mappedAccount);
            if (!mappedAccount) {
                nlapiLogExecution('ERROR', 'Unmapped Category', 'No account mapping found for ' + productCategory);
                return;
            }

            // Loop through standard GL lines and handle reclassification
            for (var i = 0; i < standardLines.getCount(); i++) {
                var line = standardLines.getLine(i);
                var accountId = line.getAccountId(); // Get the account ID
                var debitAmt = line.getDebitAmount();
                var creditAmt = line.getCreditAmount();
                nlapiLogExecution('debug', 'accountId', accountId);

                if (accountId != null && accountId != '') {
                    var accRec = nlapiLoadRecord('account', accountId);
                    var accountType = accRec.getFieldText('accttype');
                    nlapiLogExecution('debug', 'accountType', accountType);

                    // Only reverse lines with account type COGS or Expense
                    if (accountType === 'Cost of Goods Sold' || accountType === 'Expense') {
                        var entity = line.getEntityId();
                        var subsidiary = line.getSubsidiaryId();
                        var location = line.getLocationId();
                        var classId = line.getClassId();
                        var memo = line.getMemo();

                        // Check if the mapped account matches the COGS account
                        if (accountId == mappedAccount) {
                            nlapiLogExecution('debug', 'Excluding Line', 'Line with mapped account ' + mappedAccount + ' is excluded from GL.');
                            continue; // Skip this line
                        }

                        // Reverse the existing line (mirror debit/credit)
                        if (debitAmt > 0) {
                            var reverseLine = customLines.addNewLine();
                            reverseLine.setCreditAmount(debitAmt);
                            reverseLine.setAccountId(line.getAccountId()); // Same account
                            reverseLine.setEntityId(entity);
                            reverseLine.setLocationId(location);
                            reverseLine.setClassId(classId);
                           if(headerMemo)
                            reverseLine.setMemo(headerMemo);
                        }
                        if (creditAmt > 0) {
                            var reverseLine = customLines.addNewLine();
                            reverseLine.setDebitAmount(creditAmt);
                            reverseLine.setAccountId(line.getAccountId()); // Same account
                            reverseLine.setEntityId(entity);
                            reverseLine.setLocationId(location);
                            reverseLine.setClassId(classId);
                           if(headerMemo)
                            reverseLine.setMemo(headerMemo);
                        }

                        // Reclassify with mapped account
                        if (debitAmt > 0) {
                            var newLine = customLines.addNewLine();
                            newLine.setDebitAmount(debitAmt);
                            newLine.setAccountId(mappedAccount); // Mapped account based on Free Product Category
                            newLine.setEntityId(entity);
                            newLine.setLocationId(location);
                            newLine.setClassId(classId);
                           if(headerMemo)
                            newLine.setMemo(headerMemo);
                        }
                        if (creditAmt > 0) {
                            var newLine = customLines.addNewLine();
                            newLine.setCreditAmount(creditAmt);
                            newLine.setAccountId(mappedAccount); // Mapped account based on Free Product Category
                            newLine.setEntityId(entity);
                            newLine.setLocationId(location);
                            newLine.setClassId(classId);
                            if(headerMemo)
                            newLine.setMemo(headerMemo);
                        }
                    }
                }
            }
        }
    } catch (e) {
        if (e instanceof nlobjError) {
            nlapiLogExecution('ERROR', 'System Error', e.getCode() + ': ' + e.getDetails());
        } else {
            nlapiLogExecution('ERROR', 'Unexpected Error', e.toString() + ': ' + (e.stack ? e.stack : 'No stack trace available.'));
        }
    }
}
