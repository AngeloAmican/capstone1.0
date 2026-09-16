(() => {
  "use strict";

  const METHODS_KEY = "dentanueva_payment_methods";
  const REQUESTS_KEY = "dentanueva_payment_requests";
  const FINANCE_KEY = "dentaNuevaFinanceTransactions";

  function read(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }

  function getMethods() {
    return read(METHODS_KEY, {
      gcash: { enabled: true, label: "Clinic GCash", qrData: "" },
      banks: [],
    });
  }

  function saveMethods(methods) {
    write(METHODS_KEY, {
      gcash: methods.gcash || { enabled: false, label: "Clinic GCash", qrData: "" },
      banks: Array.isArray(methods.banks) ? methods.banks : [],
    });
  }

  function getRequests() {
    const requests = read(REQUESTS_KEY, []);
    return Array.isArray(requests) ? requests : [];
  }

  function saveRequests(requests) {
    write(REQUESTS_KEY, requests);
  }

  function createRequest(payload) {
    const now = new Date().toISOString();
    const request = {
      id: `PAYREQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "pending",
      submittedAt: now,
      updatedAt: now,
      claimedAmount: Number(payload.claimedAmount) || 0,
      verifiedAmount: 0,
      proofData: payload.proofData || "",
      proofName: payload.proofName || "",
      paymentMethod: payload.paymentMethod || "",
      reference: payload.reference || "",
      notes: payload.notes || "",
      transactionId: payload.transactionId || "",
      patientId: payload.patientId || "",
      patientName: payload.patientName || "Patient",
      doctorId: payload.doctorId || "",
      doctorName: payload.doctorName || "Doctor",
    };
    const requests = getRequests();
    requests.unshift(request);
    saveRequests(requests);
    return request;
  }

  function approveRequest(requestId, verifiedAmount, reviewerNote = "") {
    const requests = getRequests();
    const request = requests.find((item) => String(item.id) === String(requestId));
    if (!request || request.status !== "pending") {
      throw new Error("Payment request is no longer pending.");
    }

    const amount = Number(verifiedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid verified amount.");
    }

    const transactions = read(FINANCE_KEY, []);
    const transaction = transactions.find(
      (item) => String(item.id) === String(request.transactionId),
    );
    if (!transaction) {
      throw new Error("Billing transaction was not found.");
    }

    const total = Math.max((Number(transaction.total) || 0) - (Number(transaction.discount) || 0), 0);
    const paid = Math.max(Number(transaction.paid) || 0, 0);
    const balance = Math.max(total - paid, 0);
    if (amount > balance) {
      throw new Error("Verified amount cannot exceed the remaining balance.");
    }

    const now = new Date().toISOString();
    const history = Array.isArray(transaction.paymentHistory)
      ? transaction.paymentHistory
      : [];
    history.push({
      id: `${request.id}-CONFIRMED`,
      amount,
      claimedAmount: Number(request.claimedAmount) || 0,
      verifiedAmount: amount,
      paymentMethod: request.paymentMethod,
      reference: request.reference,
      proofName: request.proofName,
      notes: reviewerNote || request.notes,
      date: now,
      createdAt: now,
      verifiedByStaff: true,
    });

    const newPaid = Math.min(total, paid + amount);
    transaction.paymentHistory = history;
    transaction.paid = newPaid;
    transaction.balance = Math.max(total - newPaid, 0);
    transaction.status = transaction.balance <= 0 ? "Paid" : "Partial";
    transaction.updatedAt = now;
    write(FINANCE_KEY, transactions);

    request.status = "confirmed";
    request.verifiedAmount = amount;
    request.reviewedAt = now;
    request.reviewerNote = reviewerNote;
    saveRequests(requests);
    return { request, transaction };
  }

  function rejectRequest(requestId, reviewerNote = "") {
    const requests = getRequests();
    const request = requests.find((item) => String(item.id) === String(requestId));
    if (!request || request.status !== "pending") {
      throw new Error("Payment request is no longer pending.");
    }
    request.status = "rejected";
    request.reviewedAt = new Date().toISOString();
    request.reviewerNote = reviewerNote;
    saveRequests(requests);
    return request;
  }

  window.DentaNuevaPaymentService = Object.freeze({
    METHODS_KEY,
    REQUESTS_KEY,
    FINANCE_KEY,
    getMethods,
    saveMethods,
    getRequests,
    saveRequests,
    createRequest,
    approveRequest,
    rejectRequest,
  });
})();
