const fs = require('fs');

const now = Date.now();
const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const accountId1 = generateId();
const accountId2 = generateId();

const memberId1 = generateId();
const memberId2 = generateId();
const projectId1 = generateId();

const vehicleId1 = generateId();
const loanId1 = generateId();

const data = {
  version: 3,
  timestamp: new Date().toISOString(),
  profileId: "demo-profile-123",
  profileName: "Demo Profile",
  data: {
    accounts: [
      {
        id: accountId1,
        name: "Main Checking",
        type: "debit",
        bank_name: "Chase",
        current_balance: 15400.50,
        created_at: thirtyDaysAgo
      },
      {
        id: accountId2,
        name: "Rewards Credit Card",
        type: "credit",
        bank_name: "Amex",
        card_last2: "45",
        card_type: "amex",
        credit_limit: 20000,
        current_balance: 1250.75,
        bill_date: 15,
        due_date: 5,
        created_at: thirtyDaysAgo
      }
    ],
    transactions: [
      {
        id: generateId(),
        account_id: accountId1,
        amount: -50.00,
        category: "needs",
        sub_category: "Groceries",
        note: "Whole Foods",
        date: fifteenDaysAgo,
        is_joint_expense: false
      },
      {
        id: generateId(),
        account_id: accountId1,
        amount: -85.50,
        category: "needs",
        sub_category: "Utilities",
        note: "Electric Bill",
        date: thirtyDaysAgo + 86400000,
        is_joint_expense: false
      },
      {
        id: generateId(),
        account_id: accountId2,
        amount: -120.00,
        category: "wants",
        sub_category: "Dining",
        note: "Steakhouse",
        date: now - 86400000,
        is_joint_expense: false
      },
      {
        id: generateId(),
        account_id: accountId2,
        amount: -15.00,
        category: "wants",
        sub_category: "Entertainment",
        note: "Netflix",
        date: now - 2 * 86400000,
        is_joint_expense: false
      },
      {
        id: generateId(),
        account_id: accountId1,
        amount: -500.00,
        category: "savings",
        sub_category: "Emergency Fund",
        note: "Monthly transfer",
        date: now - 5 * 86400000,
        is_joint_expense: false
      }
    ],
    income_sources: [
      {
        id: generateId(),
        name: "Primary Salary",
        amount: 8500,
        frequency: "monthly",
        date: now
      },
      {
        id: generateId(),
        name: "Freelance Client",
        amount: 1200,
        frequency: "monthly",
        date: now
      }
    ],
    loans: [
      {
        id: loanId1,
        type: "vehicle",
        lender: "Auto Finance",
        principal: 25000,
        roi: 4.5,
        tenure_months: 60,
        start_date: thirtyDaysAgo - 100 * 86400000, // started 130 days ago
        emi_day: 10,
        paid_emis: 4,
        account_id: accountId1
      },
      {
        id: generateId(),
        type: "housing",
        lender: "HDFC Bank",
        principal: 500000,
        roi: 8.5,
        tenure_months: 240,
        start_date: thirtyDaysAgo - 1000 * 86400000,
        emi_day: 5,
        paid_emis: 30,
        account_id: accountId1
      }
    ],
    joint_projects: [
      {
        id: projectId1,
        name: "Vacation Fund",
        description: "Europe Trip 2026",
        status: "active",
        created_at: thirtyDaysAgo
      }
    ],
    joint_members: [
      {
        id: memberId1,
        project_id: projectId1,
        name: "Self",
        is_self: true,
        ownership_pct: 50
      },
      {
        id: memberId2,
        project_id: projectId1,
        name: "Partner",
        is_self: false,
        ownership_pct: 50
      }
    ],
    joint_contributions: [
      {
        id: generateId(),
        project_id: projectId1,
        member_id: memberId1,
        amount: 500,
        description: "Initial deposit",
        date: thirtyDaysAgo,
        is_joint_emi: false
      },
      {
        id: generateId(),
        project_id: projectId1,
        member_id: memberId2,
        amount: 500,
        description: "Initial deposit matching",
        date: thirtyDaysAgo,
        is_joint_emi: false
      }
    ],
    stocks: [
      {
        id: generateId(),
        symbol: "AAPL",
        name: "Apple Inc.",
        quantity: 50,
        avg_buy_price: 150,
        current_price: 185,
        last_updated: now
      },
      {
        id: generateId(),
        symbol: "MSFT",
        name: "Microsoft",
        quantity: 20,
        avg_buy_price: 300,
        current_price: 380,
        last_updated: now
      },
      {
        id: generateId(),
        symbol: "VOO",
        name: "Vanguard S&P 500 ETF",
        quantity: 100,
        avg_buy_price: 380,
        current_price: 450,
        last_updated: now
      }
    ],
    goals: [
      {
        id: generateId(),
        name: "Emergency Fund",
        target_amount: 30000,
        current_amount: 15000,
        target_date: now + 365 * 24 * 60 * 60 * 1000,
        color: "#4CAF50"
      },
      {
        id: generateId(),
        name: "New Car Downpayment",
        target_amount: 10000,
        current_amount: 2500,
        target_date: now + 180 * 24 * 60 * 60 * 1000,
        color: "#2196F3"
      }
    ],
    chittys: [
      {
        id: generateId(),
        name: "KSFE Regular",
        monthly_installment: 5000,
        total_value: 100000,
        duration_months: 20,
        start_date: thirtyDaysAgo,
        auction_dividends: 1200
      }
    ],
    vehicles: [
      {
        id: vehicleId1,
        name: "Honda Civic",
        reg_number: "ABC-1234",
        odometer: 45000,
        insurance_due: now + 60 * 24 * 60 * 60 * 1000,
        loan_id: loanId1,
        next_service_date: now + 90 * 24 * 60 * 60 * 1000,
        next_service_km: 50000
      }
    ],
    service_logs: [
      {
        id: generateId(),
        vehicle_id: vehicleId1,
        date: thirtyDaysAgo,
        odometer: 44000,
        service_name: "Oil Change",
        description: "Regular synthetic oil change",
        cost: 65,
        is_recurring: true,
        recurring_by: "km",
        next_service_km: 50000,
        next_service_date: null
      },
      {
        id: generateId(),
        vehicle_id: vehicleId1,
        date: thirtyDaysAgo - 365 * 86400000,
        odometer: 35000,
        service_name: "Tire Replacement",
        description: "4 new all-season tires",
        cost: 450,
        is_recurring: false,
        recurring_by: null,
        next_service_km: null,
        next_service_date: null
      }
    ]
  }
};

fs.writeFileSync('FinTrack_Demo_Profile_Backup.json', JSON.stringify(data, null, 2));
console.log("Demo profile generated at FinTrack_Demo_Profile_Backup.json");
