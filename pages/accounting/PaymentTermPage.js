const SettingsEntityPage = require('../base/SettingsEntityPage');

/**
 * Payment Term (Settings > Payment Terms).
 * Source: erpforce-fe modules/accounting/src/views/settings/payment-term/*
 * Routes: list /dashboard/accounting/settings/payment-terms (plural),
 * add /dashboard/accounting/settings/payment-term/add-payment-term (singular) - confirmed
 * against the running app that the list and add routes use different pluralization.
 * Confirmed against the running app: required fields are name, due_date_based_on (select) and
 * credit_days (number); mode_of_payment (select) and the discount_* fields/description are
 * optional (submitting without them raised no validation error).
 */
class PaymentTermPage extends SettingsEntityPage {
  constructor(page) {
    super(page, {
      entityKey: 'add_payment_term',
      listPath: '/dashboard/accounting/settings/payment-terms',
      addPath: '/dashboard/accounting/settings/payment-term/add-payment-term',
    });
  }

  /** Fills the add form; caller (or the shared settings-entity test contract) triggers save(). */
  async create({ due_date_based_on, mode_of_payment, discount_type, discount_due_date_based_on, ...rest }) {
    if (due_date_based_on) await this.selectField('due_date_based_on', due_date_based_on);
    if (mode_of_payment) await this.selectField('mode_of_payment', mode_of_payment);
    if (discount_type) await this.selectField('discount_type', discount_type);
    if (discount_due_date_based_on) await this.selectField('discount_due_date_based_on', discount_due_date_based_on);
    await this.fillForm(rest);
  }
}

module.exports = PaymentTermPage;
