import fs from 'fs';
import path from 'path';
import {
  TableSection,
  Transaction,
  TRANSATION_EVENT_TYPE,
} from '../../tradeRepublic';
import { formatDate } from '../../../utils';

const OUTPUT_DIR = 'build';
const FILENAME = 'snowball_transactions.csv';

const signToCurrency: any = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

export const convertTransactionsToSnowballCsv = (data: Transaction[]) => {
  if (!data?.length) {
    console.warn(
      'No data provided to convert to CSV. No file will be created.',
    );
    return;
  }

  const headers = [
    'Event',
    'Date',
    'Symbol',
    'Price',
    'Quantity',
    'Currency',
    'FeeTax',
    'Exchange',
    'FeeCurrency',
    'Note',
  ];

  let csvRows = [];
  csvRows.push(headers.join(','));

  data.forEach((item) => {
    // Skip canceled transactions
    if (item.status === 'CANCELED') return;

    // Dividends
    if (
      item.eventType === TRANSATION_EVENT_TYPE.SSP_CORPORATE_ACTION_INVOICE_CASH
    ) {
      const event = 'Dividend';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.icon.split('/')[1];
      const exchange = '';
      const note = item.title;
      let price: string | undefined;
      let quantity: string | undefined;
      let currency: string | undefined;
      let feeTax: string | undefined;
      let feeCurrency: string | undefined;

      item.sections?.forEach((section) => {
        if ('title' in section && section.title === 'Transaction') {
          const tableSection = section as TableSection;
          const SharesSubsection = tableSection.data.find(
            (subSection) => subSection.title === 'Shares',
          );
          const dividendPerShareSubsction = tableSection.data.find(
            (subSection) => subSection.title === 'Dividend per share',
          );
          const feeSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Tax',
          );
          price = dividendPerShareSubsction?.detail?.text?.slice(1);
          quantity = SharesSubsection?.detail?.text;
          currency =
            signToCurrency[dividendPerShareSubsction?.detail?.text?.[0]!];
          feeTax = feeSubSection?.detail?.text?.slice(1);
          feeCurrency = signToCurrency[feeSubSection?.detail?.text?.[0]!];
        }
      });

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Buy and Sell transactions (trades, savings plans, roundups and 15 euros per month bonus)
    if (
      [
        TRANSATION_EVENT_TYPE.TRADING_TRADE_EXECUTED,
        TRANSATION_EVENT_TYPE.TRADING_SAVINGSPLAN_EXECUTED,
        TRANSATION_EVENT_TYPE.BENEFITS_SPARE_CHANGE_EXECUTION,
        TRANSATION_EVENT_TYPE.BENEFITS_SAVEBACK_EXECUTION,
      ].includes(item.eventType)
    ) {
      const event = item.amount.value < 0 ? 'Buy' : 'Sell';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.icon.split('/')[1];
      const exchange = '';
      const note = item.title;
      let price: string | undefined;
      let quantity: string | undefined;
      let currency: string | undefined;
      let feeTax: string | undefined;
      let feeCurrency: string | undefined;

      item.sections?.forEach((section) => {
        if ('title' in section && section.title === 'Overview') {
          const tableSection = section as TableSection;
          const transactionSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Transaction',
          );
          const feeSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Fee',
          );
          price = transactionSubSection?.detail?.displayValue?.text?.slice(1);
          quantity = transactionSubSection?.detail?.displayValue?.prefix?.slice(
            0,
            -3,
          );
          currency =
            signToCurrency[
              transactionSubSection?.detail?.displayValue?.text?.[0]!
            ];
          feeTax =
            feeSubSection?.detail?.text === 'Free'
              ? ''
              : feeSubSection?.detail?.text?.slice(1);
          feeCurrency =
            feeSubSection?.detail?.text === 'Free'
              ? ''
              : signToCurrency[feeSubSection?.detail?.text?.[0]!];
        }
      });

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Interest
    if (item.eventType === TRANSATION_EVENT_TYPE.INTEREST_PAYOUT) {
      const event = 'Cash_Gain';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.amount.currency;
      const exchange = '';
      const note = item.title;
      let price = 1;
      let quantity: string | undefined;
      let currency: string | undefined;
      let feeTax: string | undefined;
      let feeCurrency: string | undefined;

      item.sections?.forEach((section) => {
        if ('title' in section && section.title === 'Transaction') {
          const tableSection = section as TableSection;
          const accruedSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Accrued',
          );
          const taxSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Tax',
          );
          quantity = accruedSubSection?.detail?.text?.slice(1);
          currency = signToCurrency[accruedSubSection?.detail?.text?.[0]!];
          feeTax = taxSubSection?.detail?.text?.slice(1);
          feeCurrency = signToCurrency[taxSubSection?.detail?.text?.[0]!];
        }
      });

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Fees (card order fees)
    if (item.eventType === TRANSATION_EVENT_TYPE.CARD_ORDER_BILLED) {
      const event = 'Fee';
      const date = formatDate(new Date(item.timestamp));
      const symbol = '';
      const exchange = '';
      const note = item.title;
      let price = 1;
      let quantity = item.amount.value;
      let currency = item.amount.currency;
      let feeTax = '';
      let feeCurrency = '';

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Payments, refunds, tax corrections, send stock gifts
    if (
      [
        TRANSATION_EVENT_TYPE.CARD_SUCCESSFUL_TRANSACTION,
        TRANSATION_EVENT_TYPE.CARD_REFUND,
        TRANSATION_EVENT_TYPE.SSP_TAX_CORRECTION_INVOICE,
        TRANSATION_EVENT_TYPE.GIFTER_TRANSACTION,
      ].includes(item.eventType)
    ) {
      const event = item.amount.value > 0 ? 'Cash_Gain' : 'Cash_Expense';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.amount.currency;
      const exchange = '';
      const note = item.title;
      let price = 1;
      let quantity = item.amount.value;
      let currency = item.amount.currency;
      let feeTax = '';
      let feeCurrency = '';

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Transactions
    if (
      [
        TRANSATION_EVENT_TYPE.INCOMING_TRANSFER_DELEGATION,
        TRANSATION_EVENT_TYPE.OUTGOING_TRANSFER_DELEGATION,
        TRANSATION_EVENT_TYPE.OUTGOING_TRANSFER,
        TRANSATION_EVENT_TYPE.INCOMING_TRANSFER,
      ].includes(item.eventType)
    ) {
      const event = item.amount.value > 0 ? 'Cash_In' : 'Cash_Out';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.amount.currency;
      const exchange = '';
      const note = item.title;
      let price = 1;
      let quantity = item.amount.value;
      let currency = item.amount.currency;
      let feeTax = '';
      let feeCurrency = '';

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Legacy transactions (trades, savings plans)
    if (
      item.eventType ===
        TRANSATION_EVENT_TYPE.TIMELINE_LEGACY_MIGRATED_EVENTS &&
      item.subtitle !== null &&
      ['Saving executed', 'Sell Order', 'Buy Order'].includes(item.subtitle)
    ) {
      const event = item.amount.value < 0 ? 'Buy' : 'Sell';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.icon.split('/')[1];
      const exchange = '';
      const note = item.title;
      let price: string | undefined;
      let quantity: string | undefined;
      let currency: string | undefined;
      let feeTax: string | undefined;
      let feeCurrency: string | undefined;

      item.sections?.forEach((section) => {
        if ('title' in section && section.title === 'Transaction') {
          const tableSection = section as TableSection;
          const sharesSubsection = tableSection.data.find(
            (subSection) => subSection.title === 'Shares',
          );
          const sharesPriceSubsection = tableSection.data.find(
            (subSection) => subSection.title === 'Share price',
          );
          const feeSubSection = tableSection.data.find(
            (subSection) => subSection.title === 'Fee',
          );
          price = sharesPriceSubsection?.detail?.text?.slice(1);
          quantity = sharesSubsection?.detail?.text;
          currency = signToCurrency[sharesPriceSubsection?.detail?.text?.[0]!];
          feeTax =
            feeSubSection?.detail?.text === 'Free'
              ? ''
              : feeSubSection?.detail?.text?.slice(1);
          feeCurrency =
            feeSubSection?.detail?.text === 'Free'
              ? ''
              : signToCurrency[feeSubSection?.detail?.text?.[0]!];
        }
      });

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Legacy transactions (Interest)
    if (
      item.eventType ===
        TRANSATION_EVENT_TYPE.TIMELINE_LEGACY_MIGRATED_EVENTS &&
      item.title === 'Interest' &&
      item.subtitle === null
    ) {
      const event = 'Cash_Gain';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.amount.currency;
      const exchange = '';
      const price = 1;
      const quantity = item.amount.value;
      const currency = item.amount.currency;
      const feeTax = '';
      const feeCurrency = '';
      const note = item.title;

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    // Legacy transactions (Transfers)
    if (
      item.eventType ===
        TRANSATION_EVENT_TYPE.TIMELINE_LEGACY_MIGRATED_EVENTS &&
      item.title !== 'Interest' &&
      item.subtitle === null
    ) {
      const event = item.amount.value > 0 ? 'Cash_In' : 'Cash_Out';
      const date = formatDate(new Date(item.timestamp));
      const symbol = item.amount.currency;
      const exchange = '';
      const price = 1;
      const quantity = item.amount.value;
      const currency = item.amount.currency;
      const feeTax = '';
      const feeCurrency = '';
      const note = item.title;

      const row = [
        event,
        date,
        symbol,
        price,
        quantity,
        currency,
        feeTax,
        exchange,
        feeCurrency,
        note,
      ];

      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }
  });

  const csvString = csvRows.join('\n');
  const filePath = path.join(process.cwd(), `${OUTPUT_DIR}/${FILENAME}`);

  if (!fs.existsSync('build')) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFile(filePath, csvString, (error) => {
    if (error) {
      console.error(`Error saving CSV file "${FILENAME}".`, error);
    } else {
      console.log(`CSV file "${FILENAME}" successfully saved to ${filePath}.`);
    }
  });
};
