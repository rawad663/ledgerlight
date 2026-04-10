import { createServer } from "node:http";
import { URL } from "node:url";

import { buildScenario } from "./scenarios.mjs";

const NOW = new Date("2026-04-08T15:00:00.000Z");
const port = Number(process.env.MOCK_API_PORT ?? "4011");
const frontendBaseUrl =
  process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3005";

let state = buildScenario("full-app");
let currentScenario = "full-app";

function clone(value) {
  return structuredClone(value);
}

function sendJson(response, statusCode, payload) {
  const normalizedPayload =
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    !("statusCode" in payload)
      ? { ...payload, statusCode }
      : payload;

  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Organization-Id",
  });
  response.end(JSON.stringify(normalizedPayload));
}

function sendNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Organization-Id",
  });
  response.end();
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;
    });

    request.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function getSearchParam(url, key) {
  const value = url.searchParams.get(key);
  return value && value.length > 0 ? value : undefined;
}

function matchesSearch(value, search) {
  if (!search) {
    return true;
  }

  return value.toLowerCase().includes(search.toLowerCase());
}

function listActiveLocations() {
  return state.locations.filter((location) => location.status === "ACTIVE");
}

function createTeamLocation(location) {
  return {
    id: location.id,
    name: location.name,
  };
}

function findLocation(id) {
  return state.locations.find((location) => location.id === id);
}

function findProduct(id) {
  return state.products.find((product) => product.id === id);
}

function findCustomer(id) {
  return state.customers.find((customer) => customer.id === id);
}

function findOrder(id) {
  return state.orders.find((order) => order.id === id);
}

function findOrderByPaymentId(paymentId) {
  return state.orders.find((order) => order.payment?.id === paymentId);
}

function findTeamMember(membershipId) {
  return state.teamMembers.find((member) => member.membershipId === membershipId);
}

function toCustomerListItem(customer) {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    lifetimeSpendCents: customer.lifetimeSpendCents,
    averageOrderValueCents: customer.averageOrderValueCents,
    orderCount: customer.orderCount,
    lastOrderAt: customer.lastOrderAt,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function toCustomerDetail(customer) {
  return {
    ...toCustomerListItem(customer),
    internalNote: customer.internalNote,
  };
}

function toProductDto(product) {
  return {
    ...product,
  };
}

function toInventoryLevel(level) {
  const product = findProduct(level.productId);
  const location = findLocation(level.locationId);

  return {
    id: level.id,
    organizationId: level.organizationId,
    productId: level.productId,
    locationId: level.locationId,
    quantity: level.quantity,
    updatedAt: level.updatedAt,
    product: product
      ? {
          id: product.id,
          name: product.name,
          sku: product.sku,
          reorderThreshold: product.reorderThreshold,
        }
      : null,
    location: location
      ? {
          id: location.id,
          name: location.name,
        }
      : null,
  };
}

function toOrderListItem(order) {
  const customer = findCustomer(order.customerId);
  const location = findLocation(order.locationId);

  return {
    id: order.id,
    organizationId: order.organizationId,
    customerId: order.customerId,
    locationId: order.locationId,
    status: order.status,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    placedAt: order.placedAt,
    cancelledAt: order.cancelledAt,
    payment: order.payment ? toPaymentSummary(order.payment) : null,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        }
      : null,
    location: location
      ? {
          id: location.id,
          name: location.name,
        }
      : null,
  };
}

function toOrderDetail(order) {
  const customer = findCustomer(order.customerId);
  const location = findLocation(order.locationId);

  return {
    ...toOrderListItem(order),
    items: order.items.map((item) => ({
      ...item,
    })),
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
        }
      : null,
    location: location
      ? {
          id: location.id,
          name: location.name,
          addressLine1: location.addressLine1,
          city: location.city,
          stateProvince: location.stateProvince,
          postalCode: location.postalCode,
          countryCode: location.countryCode,
        }
      : null,
  };
}

function toPaymentSummary(payment) {
  return {
    id: payment.id,
    method: payment.method,
    paymentStatus: payment.paymentStatus,
    refundStatus: payment.refundStatus,
    financialStatus: payment.financialStatus,
    amountCents: payment.amountCents,
    currencyCode: payment.currencyCode,
    paidAt: payment.paidAt,
    refundRequestedAt: payment.refundRequestedAt,
    refundedAt: payment.refundedAt,
  };
}

function toPaymentDetail(payment) {
  return {
    ...toPaymentSummary(payment),
    orderId: payment.orderId,
    organizationId: payment.organizationId,
    stripeRefundId: payment.stripeRefundId,
    refundFailedAt: payment.refundFailedAt,
    refundReason: payment.refundReason,
    lastPaymentFailure: payment.lastPaymentFailure,
    lastRefundFailure: payment.lastRefundFailure,
    latestAttempt: payment.latestAttempt ? clone(payment.latestAttempt) : null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function buildLocationsResponse(url) {
  const search = getSearchParam(url, "search");
  const status = getSearchParam(url, "status");
  const type = getSearchParam(url, "type");
  const sortBy = getSearchParam(url, "sortBy");
  const sortOrder = getSearchParam(url, "sortOrder") ?? "asc";

  let locations = state.locations.filter((location) => {
    const searchable = [
      location.name,
      location.code,
      location.addressLine1,
      location.city,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      matchesSearch(searchable, search ?? "") &&
      (!status || location.status === status) &&
      (!type || location.type === type)
    );
  });

  if (sortBy === "name") {
    locations = locations.sort((left, right) =>
      left.name.localeCompare(right.name) * (sortOrder === "desc" ? -1 : 1),
    );
  } else {
    locations = locations.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  const limit = Number(getSearchParam(url, "limit") ?? String(locations.length));
  const paged = locations.slice(0, limit);

  return {
    data: paged.map((location) => ({
      ...clone(location),
      onHandQuantity: state.inventoryLevels
        .filter((level) => level.locationId === location.id)
        .reduce((sum, level) => sum + level.quantity, 0),
    })),
    totalCount: locations.length,
    nextCursor: undefined,
  };
}

function buildProductsResponse(url) {
  const search = getSearchParam(url, "search");
  const category = getSearchParam(url, "category");
  const isActive = getSearchParam(url, "isActive");

  const products = state.products.filter((product) => {
    if (isActive !== undefined) {
      const desired = isActive === "true";

      if (product.active !== desired) {
        return false;
      }
    } else if (!product.active) {
      return false;
    }

    return (
      matchesSearch(`${product.name} ${product.sku}`, search ?? "") &&
      (!category || product.category === category)
    );
  });

  return {
    data: products.map(toProductDto),
    totalCount: products.length,
    nextCursor: undefined,
    categories: Array.from(
      new Set(
        state.products
          .filter((product) => product.active && product.category)
          .map((product) => product.category),
      ),
    ),
  };
}

function buildCustomersResponse(url) {
  const search = getSearchParam(url, "search");
  const status = getSearchParam(url, "status");

  const customers = state.customers.filter((customer) => {
    if (!status && customer.status !== "ACTIVE") {
      return false;
    }

    return (
      (!status || customer.status === status) &&
      matchesSearch(
        `${customer.name} ${customer.email} ${customer.phone ?? ""}`,
        search ?? "",
      )
    );
  });

  return {
    data: customers.map(toCustomerListItem),
    totalCount: customers.length,
    nextCursor: undefined,
  };
}

function buildInventoryResponse(url) {
  const search = getSearchParam(url, "search");
  const locationId = getSearchParam(url, "locationId");
  const lowStockOnly = getSearchParam(url, "lowStockOnly") === "true";

  let items = state.inventoryLevels
    .map(toInventoryLevel)
    .filter((item) => item.product && item.location);

  items = items.filter((item) => {
    const matchesLocation = !locationId || item.location.id === locationId;
    const matchesText = matchesSearch(
      `${item.product.name} ${item.product.sku}`,
      search ?? "",
    );
    const lowStock = item.quantity <= item.product.reorderThreshold;

    return matchesLocation && matchesText && (!lowStockOnly || lowStock);
  });

  const lowStockCount = state.inventoryLevels
    .map(toInventoryLevel)
    .filter(
      (item) =>
        item.product &&
        item.location &&
        item.quantity <= item.product.reorderThreshold,
    ).length;

  return {
    data: items,
    totalCount: items.length,
    nextCursor: undefined,
    locations: listActiveLocations().map((location) => clone(location)),
    lowStockCount,
  };
}

function buildDashboardSummary() {
  const lowStockItemsCount = state.inventoryLevels
    .map(toInventoryLevel)
    .filter(
      (item) =>
        item.product &&
        item.quantity <= item.product.reorderThreshold,
    ).length;

  return {
    todaysSalesCents: 8893,
    ordersTodayCount: 3,
    lowStockItemsCount,
    activeCustomersCount: state.customers.filter(
      (customer) => customer.status === "ACTIVE",
    ).length,
  };
}

function buildSalesOverview(timeline = "week") {
  const bucketLabels = timeline === "month"
    ? ["Week 1", "Week 2", "Week 3", "Week 4"]
    : timeline === "day"
      ? ["8 AM", "12 PM", "4 PM", "8 PM"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const bucketCount = bucketLabels.length;
  const baseSales = timeline === "month" ? 18200 : timeline === "day" ? 3600 : 9600;

  return {
    timeline,
    anchor: NOW.toISOString(),
    periodStart: NOW.toISOString(),
    periodEnd: NOW.toISOString(),
    previousAnchor: NOW.toISOString(),
    nextAnchor: NOW.toISOString(),
    isCurrentPeriod: true,
    totalSalesCents: baseSales,
    buckets: bucketLabels.map((label, index) => ({
      bucketStart: NOW.toISOString(),
      bucketEnd: NOW.toISOString(),
      label,
      salesCents: Math.round(baseSales / bucketCount) + index * 10,
    })),
  };
}

function buildAggregatedInventoryItems() {
  return state.products
    .filter((product) => product.active)
    .map((product) => {
      const levels = state.inventoryLevels.filter(
        (level) => level.productId === product.id,
      );
      const totalQuantity = levels.reduce((sum, level) => sum + level.quantity, 0);
      const locations = levels.map((level) => {
        const location = findLocation(level.locationId);

        return {
          locationId: level.locationId,
          locationName: location?.name ?? "Unknown",
          quantity: level.quantity,
        };
      });

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        totalQuantity,
        reorderThreshold: product.reorderThreshold,
        stockGap: Math.max(product.reorderThreshold - totalQuantity, 0),
        isLowStock: totalQuantity <= product.reorderThreshold,
        locations,
      };
    })
    .filter((item) => item.isLowStock)
    .sort((left, right) => right.stockGap - left.stockGap);
}

function buildTeamStats(members) {
  return {
    activeMembers: members.filter((member) => member.status === "ACTIVE").length,
    pendingInvites: members.filter((member) => member.status === "INVITED").length,
    deactivatedMembers: members.filter((member) => member.status === "DEACTIVATED").length,
  };
}

function buildTeamMembersResponse(url) {
  const search = getSearchParam(url, "search");
  const status = getSearchParam(url, "status");
  const role = getSearchParam(url, "role");

  const members = state.teamMembers.filter((member) => {
    return (
      (!status || member.status === status) &&
      (!role || member.role === role) &&
      matchesSearch(`${member.displayName} ${member.email}`, search ?? "")
    );
  });

  return {
    data: members.map((member) => clone(member)),
    stats: buildTeamStats(state.teamMembers),
    totalCount: members.length,
    nextCursor: undefined,
  };
}

function createOrderTotals(order) {
  const subtotalCents = order.items.reduce(
    (sum, item) => sum + item.qty * item.unitPriceCents,
    0,
  );
  const discountCents = order.items.reduce(
    (sum, item) => sum + item.discountCents,
    0,
  );
  const taxCents = order.items.reduce((sum, item) => sum + item.taxCents, 0);

  order.subtotalCents = subtotalCents;
  order.discountCents = discountCents;
  order.taxCents = taxCents;
  order.totalCents = subtotalCents - discountCents + taxCents;

  if (order.payment) {
    order.payment.amountCents = order.totalCents;
    order.payment.updatedAt = new Date().toISOString();
  }
}

function deriveFinancialStatus(payment) {
  if (!payment) {
    return "NO_PAYMENT";
  }

  if (payment.refundStatus === "REFUNDED") {
    return "REFUNDED";
  }

  if (payment.refundStatus === "REQUESTED") {
    return "REFUND_REQUESTED";
  }

  if (payment.refundStatus === "PENDING") {
    return "REFUND_PENDING";
  }

  if (payment.refundStatus === "FAILED") {
    return "REFUND_FAILED";
  }

  if (payment.paymentStatus === "PAID") {
    return "PAID";
  }

  if (payment.paymentStatus === "PENDING") {
    return "PAYMENT_PENDING";
  }

  if (payment.paymentStatus === "FAILED") {
    return "PAYMENT_FAILED";
  }

  return "UNPAID";
}

function createPaymentRecord(order) {
  const timestamp = new Date().toISOString();

  order.payment = {
    id: `payment-${state.nextIds.payment++}`,
    orderId: order.id,
    organizationId: order.organizationId,
    method: null,
    paymentStatus: "UNPAID",
    refundStatus: "NONE",
    financialStatus: "UNPAID",
    amountCents: order.totalCents,
    currencyCode: "CAD",
    paidAt: null,
    refundRequestedAt: null,
    refundedAt: null,
    refundFailedAt: null,
    refundReason: null,
    lastPaymentFailure: null,
    lastRefundFailure: null,
    latestAttempt: null,
    stripeRefundId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    auditLogs: [],
  };

  appendPaymentAuditLog(order, "PAYMENT_CREATED", null, {
    paymentStatus: order.payment.paymentStatus,
    refundStatus: order.payment.refundStatus,
  });
}

function updatePaymentState(payment, nextValues) {
  Object.assign(payment, nextValues, {
    updatedAt: new Date().toISOString(),
  });
  payment.financialStatus = deriveFinancialStatus(payment);
}

function appendPaymentAuditLog(order, action, beforeJson, afterJson) {
  if (!order.payment) {
    return;
  }

  order.payment.auditLogs.unshift({
    id: `audit-${state.nextIds.audit++}`,
    entityType: "PAYMENT",
    entityId: order.payment.id,
    action,
    createdAt: new Date().toISOString(),
    actor: {
      id: state.teamUsers.owner.id,
      firstName: state.teamUsers.owner.firstName,
      lastName: state.teamUsers.owner.lastName,
      email: state.teamUsers.owner.email,
    },
    beforeJson,
    afterJson,
  });
}

function appendAuditLog(order, action, beforeJson, afterJson) {
  order.auditLogs.unshift({
    id: `audit-${state.nextIds.audit++}`,
    entityType: "ORDER",
    entityId: order.id,
    action,
    createdAt: new Date().toISOString(),
    actor: {
      id: state.teamUsers.owner.id,
      firstName: state.teamUsers.owner.firstName,
      lastName: state.teamUsers.owner.lastName,
      email: state.teamUsers.owner.email,
    },
    beforeJson,
    afterJson,
  });
}

function buildControlPayload() {
  return {
    scenario: currentScenario,
    sessions: clone(state.sessions),
    teamMembers: clone(state.teamMembers),
    invitationTokens: {
      expired: "expired-token",
      newUser: "new-user-token",
      existingUser: "existing-user-token",
      invalid: "invalid-token",
    },
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/__health") {
    sendJson(response, 200, { ok: true, frontendBaseUrl });
    return;
  }

  if (request.method === "POST" && url.pathname === "/__scenario/reset") {
    const body = await parseBody(request);
    currentScenario = body.name || "full-app";
    state = buildScenario(currentScenario);
    sendJson(response, 200, buildControlPayload());
    return;
  }

  if (request.method === "GET" && url.pathname === "/__scenario/current") {
    sendJson(response, 200, buildControlPayload());
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/login") {
    const body = await parseBody(request);
    const authUser = state.authUsers.find(
      (user) =>
        user.email.toLowerCase() === String(body.email ?? "").toLowerCase(),
    );

    if (!authUser || body.password !== authUser.password) {
      sendJson(response, 401, { message: "Invalid email or password" });
      return;
    }

    authUser.user.lastLoginAt = new Date().toISOString();
    const session = state.sessions[authUser.sessionKey];

    sendJson(response, 200, {
      accessToken: session.accessToken,
      refreshTokenRaw: session.refreshToken,
      user: clone(authUser.user),
      memberships: clone(authUser.memberships),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    sendJson(response, 200, { success: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/refresh") {
    const body = await parseBody(request);
    const refreshState = state.refreshTokens[body.refreshTokenRaw];

    if (!refreshState || refreshState.userId !== body.userId) {
      sendJson(response, 401, { message: "Refresh token is invalid or expired" });
      return;
    }

    sendJson(response, 200, {
      accessToken: refreshState.nextAccessToken,
      user: clone(refreshState.user),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/dashboard/summary") {
    sendJson(response, 200, buildDashboardSummary());
    return;
  }

  if (request.method === "GET" && url.pathname === "/dashboard/sales-overview") {
    sendJson(response, 200, buildSalesOverview(getSearchParam(url, "timeline")));
    return;
  }

  if (request.method === "GET" && url.pathname === "/inventory") {
    sendJson(response, 200, {
      data: buildAggregatedInventoryItems(),
      totalCount: buildAggregatedInventoryItems().length,
      nextCursor: undefined,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/inventory/levels") {
    sendJson(response, 200, buildInventoryResponse(url));
    return;
  }

  if (request.method === "POST" && url.pathname === "/inventory/adjustments") {
    const body = await parseBody(request);
    const level = state.inventoryLevels.find(
      (item) =>
        item.productId === body.productId && item.locationId === body.locationId,
    );

    if (!level) {
      sendJson(response, 404, { message: "Inventory level was not found" });
      return;
    }

    if (level.quantity + body.delta < 0) {
      sendJson(response, 400, { message: "Inventory cannot go below zero" });
      return;
    }

    level.quantity += body.delta;
    level.updatedAt = new Date().toISOString();

    sendJson(response, 201, {
      id: `adjustment-${Date.now()}`,
      productId: level.productId,
      locationId: level.locationId,
      delta: body.delta,
      reason: body.reason,
      note: body.note ?? null,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/locations") {
    sendJson(response, 200, buildLocationsResponse(url));
    return;
  }

  if (request.method === "POST" && url.pathname === "/locations") {
    const body = await parseBody(request);
    const location = {
      id: `loc-${state.nextIds.location++}`,
      organizationId: state.organization.id,
      name: body.name,
      code: body.code,
      type: body.type,
      status: "ACTIVE",
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2 ?? "",
      city: body.city,
      stateProvince: body.stateProvince,
      postalCode: body.postalCode,
      countryCode: body.countryCode,
      notes: body.notes ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.locations.unshift(location);
    sendJson(response, 201, clone(location));
    return;
  }

  const locationMatch = url.pathname.match(/^\/locations\/([^/]+)$/);

  if (locationMatch && request.method === "GET") {
    const location = findLocation(locationMatch[1]);

    if (!location) {
      sendJson(response, 404, { message: "Location was not found" });
      return;
    }

    sendJson(response, 200, clone(location));
    return;
  }

  if (locationMatch && request.method === "PATCH") {
    const location = findLocation(locationMatch[1]);

    if (!location) {
      sendJson(response, 404, { message: "Location was not found" });
      return;
    }

    Object.assign(location, await parseBody(request), {
      updatedAt: new Date().toISOString(),
    });
    sendJson(response, 200, clone(location));
    return;
  }

  if (locationMatch && request.method === "DELETE") {
    const locationId = locationMatch[1];

    if (locationId === "loc-1") {
      sendJson(response, 409, {
        message:
          "Cannot delete a location with inventory on hand or historical orders",
      });
      return;
    }

    state.locations = state.locations.filter((location) => location.id !== locationId);
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/products") {
    sendJson(response, 200, buildProductsResponse(url));
    return;
  }

  if (request.method === "POST" && url.pathname === "/products") {
    const body = await parseBody(request);

    if (
      state.products.some(
        (product) => product.active && product.sku.toLowerCase() === body.sku.toLowerCase(),
      )
    ) {
      sendJson(response, 409, { message: "A product with this SKU already exists" });
      return;
    }

    const product = {
      id: `prod-${state.nextIds.product++}`,
      organizationId: state.organization.id,
      name: body.name,
      sku: body.sku,
      category: body.category ?? null,
      priceCents: body.priceCents,
      reorderThreshold: body.reorderThreshold,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.products.unshift(product);

    if (body.inventory) {
      state.inventoryLevels.push({
        id: `inv-${Date.now()}`,
        organizationId: state.organization.id,
        productId: product.id,
        locationId: body.inventory.locationId,
        quantity: body.inventory.quantity,
        updatedAt: new Date().toISOString(),
      });
    }

    sendJson(response, 201, clone(product));
    return;
  }

  const productMatch = url.pathname.match(/^\/products\/([^/]+)$/);

  if (productMatch && request.method === "PATCH") {
    const product = findProduct(productMatch[1]);

    if (!product) {
      sendJson(response, 404, { message: "Product was not found" });
      return;
    }

    const body = await parseBody(request);

    if (
      body.sku &&
      state.products.some(
        (candidate) =>
          candidate.id !== product.id &&
          candidate.active &&
          candidate.sku.toLowerCase() === body.sku.toLowerCase(),
      )
    ) {
      sendJson(response, 409, { message: "A product with this SKU already exists" });
      return;
    }

    Object.assign(product, body, {
      updatedAt: new Date().toISOString(),
    });
    sendJson(response, 200, clone(product));
    return;
  }

  if (productMatch && request.method === "DELETE") {
    const product = findProduct(productMatch[1]);

    if (!product) {
      sendJson(response, 404, { message: "Product was not found" });
      return;
    }

    product.active = false;
    product.updatedAt = new Date().toISOString();
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/customers") {
    sendJson(response, 200, buildCustomersResponse(url));
    return;
  }

  if (request.method === "POST" && url.pathname === "/customers") {
    const body = await parseBody(request);

    if (
      state.customers.some(
        (customer) =>
          customer.email.toLowerCase() === String(body.email).toLowerCase() &&
          customer.status !== "INACTIVE",
      )
    ) {
      sendJson(response, 409, {
        message: "A customer with this email already exists",
      });
      return;
    }

    const customer = {
      id: `cust-${state.nextIds.customer++}`,
      organizationId: state.organization.id,
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      status: "ACTIVE",
      internalNote: body.internalNote ?? "",
      orderCount: 0,
      lifetimeSpendCents: 0,
      averageOrderValueCents: 0,
      lastOrderAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.customers.unshift(customer);
    sendJson(response, 201, toCustomerDetail(customer));
    return;
  }

  const customerMatch = url.pathname.match(/^\/customers\/([^/]+)$/);

  if (customerMatch && request.method === "GET") {
    const customer = findCustomer(customerMatch[1]);

    if (!customer) {
      sendJson(response, 404, { message: "Customer was not found" });
      return;
    }

    sendJson(response, 200, toCustomerDetail(customer));
    return;
  }

  if (customerMatch && request.method === "PATCH") {
    const customer = findCustomer(customerMatch[1]);

    if (!customer) {
      sendJson(response, 404, { message: "Customer was not found" });
      return;
    }

    const body = await parseBody(request);
    Object.assign(customer, body, {
      updatedAt: new Date().toISOString(),
    });
    sendJson(response, 200, toCustomerDetail(customer));
    return;
  }

  if (customerMatch && request.method === "DELETE") {
    const customer = findCustomer(customerMatch[1]);

    if (!customer) {
      sendJson(response, 404, { message: "Customer was not found" });
      return;
    }

    customer.status = "INACTIVE";
    customer.updatedAt = new Date().toISOString();
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/orders") {
    const search = getSearchParam(url, "search");
    const status = getSearchParam(url, "status");
    const locationId = getSearchParam(url, "locationId");
    const sortOrder = getSearchParam(url, "sortOrder") ?? "desc";

    let orders = state.orders.filter((order) => {
      const customer = findCustomer(order.customerId);
      const searchable = `${order.id} ${customer?.name ?? ""}`;

      return (
        (!status || order.status === status) &&
        (!locationId || order.locationId === locationId) &&
        matchesSearch(searchable, search ?? "")
      );
    });

    orders = orders.sort((left, right) =>
      sortOrder === "asc"
        ? left.createdAt.localeCompare(right.createdAt)
        : right.createdAt.localeCompare(left.createdAt),
    );

    sendJson(response, 200, {
      data: orders.map(toOrderListItem),
      totalCount: orders.length,
      nextCursor: undefined,
      locations: listActiveLocations().map((location) => ({
        id: location.id,
        name: location.name,
      })),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/orders") {
    const body = await parseBody(request);
    const items = (body.orderItems ?? []).map((item) => {
      const product = findProduct(item.productId);

      return {
        id: `item-${state.nextIds.item++}`,
        productId: item.productId,
        productName: product?.name ?? "Unknown product",
        sku: product?.sku ?? "UNKNOWN",
        qty: item.qty,
        unitPriceCents: product?.priceCents ?? 0,
        discountCents: item.discountCents ?? 0,
        taxCents: item.taxCents ?? 0,
        lineSubtotalCents: (product?.priceCents ?? 0) * item.qty,
        lineTotalCents:
          (product?.priceCents ?? 0) * item.qty -
          (item.discountCents ?? 0) +
          (item.taxCents ?? 0),
      };
    });

    const order = {
      id: `33333333-3333-3333-3333-${String(state.nextIds.order).padStart(12, "0")}`,
      organizationId: state.organization.id,
      customerId: body.customerId,
      locationId: body.locationId,
      status: "PENDING",
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placedAt: null,
      cancelledAt: null,
      payment: null,
      items,
      auditLogs: [],
    };

    state.nextIds.order += 1;
    createOrderTotals(order);
    appendAuditLog(order, "CREATE", null, { status: "PENDING" });
    state.orders.unshift(order);

    sendJson(response, 201, { id: order.id });
    return;
  }

  const orderMatch = url.pathname.match(/^\/orders\/([^/]+)$/);

  if (orderMatch && request.method === "GET") {
    const order = findOrder(orderMatch[1]);

    if (!order) {
      sendJson(response, 404, { message: "Order was not found" });
      return;
    }

    sendJson(response, 200, toOrderDetail(order));
    return;
  }

  if (orderMatch && request.method === "PATCH") {
    const order = findOrder(orderMatch[1]);

    if (!order) {
      sendJson(response, 404, { message: "Order was not found" });
      return;
    }

    const body = await parseBody(request);
    const before = {
      customerId: order.customerId,
      locationId: order.locationId,
    };
    order.customerId = body.customerId;
    order.locationId = body.locationId;
    order.updatedAt = new Date().toISOString();
    appendAuditLog(order, "UPDATE", before, {
      customerId: order.customerId,
      locationId: order.locationId,
    });
    sendJson(response, 200, toOrderDetail(order));
    return;
  }

  const orderTransitionMatch = url.pathname.match(
    /^\/orders\/([^/]+)\/transition-status$/,
  );

  if (orderTransitionMatch && request.method === "POST") {
    const order = findOrder(orderTransitionMatch[1]);

    if (!order) {
      sendJson(response, 404, { message: "Order was not found" });
      return;
    }

    const body = await parseBody(request);
    const beforeStatus = order.status;

    if (body.toStatus === "CONFIRMED" && order.status === "PENDING") {
      order.status = "CONFIRMED";
      order.placedAt = new Date().toISOString();
      order.cancelledAt = null;
      if (!order.payment) {
        createPaymentRecord(order);
      }
    } else if (body.toStatus === "FULFILLED" && order.status === "CONFIRMED") {
      if (order.payment?.paymentStatus !== "PAID") {
        sendJson(response, 400, { message: "Order must be paid before fulfillment" });
        return;
      }

      if (
        order.payment?.refundStatus === "REQUESTED" ||
        order.payment?.refundStatus === "PENDING"
      ) {
        sendJson(response, 400, { message: "Order cannot be fulfilled during an active refund" });
        return;
      }

      order.status = "FULFILLED";
    } else if (body.toStatus === "CANCELLED") {
      if (order.payment?.paymentStatus === "PAID") {
        sendJson(response, 400, { message: "Paid orders must be refunded instead of cancelled" });
        return;
      }

      if (
        order.payment?.refundStatus === "REQUESTED" ||
        order.payment?.refundStatus === "PENDING"
      ) {
        sendJson(response, 400, { message: "Order cannot be cancelled during an active refund" });
        return;
      }

      order.status = "CANCELLED";
      order.cancelledAt = new Date().toISOString();
    } else if (body.toStatus === "PENDING" && order.status === "CANCELLED") {
      if (
        order.payment?.paymentStatus === "PAID" ||
        order.payment?.refundStatus === "REQUESTED" ||
        order.payment?.refundStatus === "PENDING"
      ) {
        sendJson(response, 400, { message: "This order cannot be reopened" });
        return;
      }

      if (order.payment) {
        appendPaymentAuditLog(
          order,
          "PAYMENT_REOPEN_VOIDED",
          { paymentStatus: order.payment.paymentStatus },
          { paymentStatus: null },
        );
      }

      order.status = "PENDING";
      order.cancelledAt = null;
      order.placedAt = null;
      order.payment = null;
    } else {
      order.status = body.toStatus;
    }

    order.updatedAt = new Date().toISOString();

    appendAuditLog(order, "STATUS_CHANGE", { status: beforeStatus }, {
      status: order.status,
    });
    sendJson(response, 200, toOrderDetail(order));
    return;
  }

  const orderItemsMatch = url.pathname.match(/^\/orders\/([^/]+)\/items$/);

  if (orderItemsMatch && request.method === "POST") {
    const order = findOrder(orderItemsMatch[1]);

    if (!order) {
      sendJson(response, 404, { message: "Order was not found" });
      return;
    }

    const body = await parseBody(request);
    const product = findProduct(body.productId);

    if (!product) {
      sendJson(response, 404, { message: "Product was not found" });
      return;
    }

    if (order.items.some((item) => item.productId === body.productId)) {
      sendJson(response, 409, { message: "This product is already on the order." });
      return;
    }

    order.items.push({
      id: `item-${state.nextIds.item++}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      qty: body.qty,
      unitPriceCents: product.priceCents,
      discountCents: body.discountCents ?? 0,
      taxCents: body.taxCents ?? 0,
      lineSubtotalCents: product.priceCents * body.qty,
      lineTotalCents:
        product.priceCents * body.qty -
        (body.discountCents ?? 0) +
        (body.taxCents ?? 0),
    });

    createOrderTotals(order);
    appendAuditLog(order, "UPDATE", null, { items: order.items.length });
    sendJson(response, 200, toOrderDetail(order));
    return;
  }

  const orderItemMatch = url.pathname.match(/^\/orders\/([^/]+)\/items\/([^/]+)$/);

  if (orderItemMatch && request.method === "DELETE") {
    const order = findOrder(orderItemMatch[1]);

    if (!order) {
      sendJson(response, 404, { message: "Order was not found" });
      return;
    }

    order.items = order.items.filter((item) => item.id !== orderItemMatch[2]);
    createOrderTotals(order);
    appendAuditLog(order, "UPDATE", null, { items: order.items.length });
    sendJson(response, 200, toOrderDetail(order));
    return;
  }

  const paymentMatch = url.pathname.match(/^\/payments\/([^/]+)$/);

  if (paymentMatch && request.method === "GET") {
    const order = findOrder(paymentMatch[1]);

    if (!order || !order.payment) {
      sendJson(response, 404, { message: "Payment was not found" });
      return;
    }

    sendJson(response, 200, toPaymentDetail(order.payment));
    return;
  }

  const paymentCardMatch = url.pathname.match(/^\/payments\/([^/]+)\/card$/);

  if (paymentCardMatch && request.method === "POST") {
    const order = findOrder(paymentCardMatch[1]);

    if (!order || !order.payment) {
      sendJson(response, 404, { message: "Payment was not found" });
      return;
    }

    if (order.payment.paymentStatus === "PAID") {
      sendJson(response, 400, { message: "This order has already been paid" });
      return;
    }

    if (
      order.payment.refundStatus === "REQUESTED" ||
      order.payment.refundStatus === "PENDING"
    ) {
      sendJson(response, 400, { message: "Card payments are locked during refunds" });
      return;
    }

    if (
      order.payment.latestAttempt &&
      ["PENDING", "REQUIRES_ACTION"].includes(order.payment.latestAttempt.status)
    ) {
      sendJson(response, 201, {
        paymentId: order.payment.id,
        attemptId: order.payment.latestAttempt.id,
        clientSecret: order.payment.latestAttempt.clientSecret,
        paymentStatus: order.payment.paymentStatus,
        attemptStatus: order.payment.latestAttempt.status,
      });
      return;
    }

    const now = new Date().toISOString();
    const attempt = {
      id: `payment-attempt-${state.nextIds.paymentAttempt++}`,
      stripePaymentIntentId: `pi_${Date.now()}`,
      clientSecret: `cs_${Date.now()}`,
      status: "PENDING",
      lastFailure: null,
      createdAt: now,
      updatedAt: now,
    };

    const before = {
      paymentStatus: order.payment.paymentStatus,
      latestAttemptId: order.payment.latestAttempt?.id ?? null,
    };

    updatePaymentState(order.payment, {
      method: "CARD",
      paymentStatus: "PENDING",
      lastPaymentFailure: null,
      latestAttempt: attempt,
    });

    appendPaymentAuditLog(order, "PAYMENT_ATTEMPT_STARTED", before, {
      paymentStatus: order.payment.paymentStatus,
      latestAttemptId: attempt.id,
    });

    sendJson(response, 201, {
      paymentId: order.payment.id,
      attemptId: attempt.id,
      clientSecret: attempt.clientSecret,
      paymentStatus: order.payment.paymentStatus,
      attemptStatus: attempt.status,
    });
    return;
  }

  const paymentCardConfirmMatch = url.pathname.match(
    /^\/payments\/([^/]+)\/card\/confirm$/,
  );

  if (paymentCardConfirmMatch && request.method === "POST") {
    const order = findOrder(paymentCardConfirmMatch[1]);

    if (!order || !order.payment || !order.payment.latestAttempt) {
      sendJson(response, 404, { message: "Card payment attempt was not found" });
      return;
    }

    const attempt = order.payment.latestAttempt;
    const before = {
      paymentStatus: order.payment.paymentStatus,
      attemptStatus: attempt.status,
    };

    attempt.status = "SUCCEEDED";
    attempt.updatedAt = new Date().toISOString();

    updatePaymentState(order.payment, {
      method: "CARD",
      paymentStatus: "PAID",
      paidAt: order.payment.paidAt ?? new Date().toISOString(),
      lastPaymentFailure: null,
      latestAttempt: attempt,
    });

    appendPaymentAuditLog(order, "PAYMENT_PAID", before, {
      paymentStatus: order.payment.paymentStatus,
      attemptStatus: attempt.status,
    });

    sendJson(response, 200, toPaymentDetail(order.payment));
    return;
  }

  const paymentCashMatch = url.pathname.match(/^\/payments\/([^/]+)\/cash$/);

  if (paymentCashMatch && request.method === "POST") {
    const order = findOrder(paymentCashMatch[1]);

    if (!order || !order.payment) {
      sendJson(response, 404, { message: "Payment was not found" });
      return;
    }

    const before = { paymentStatus: order.payment.paymentStatus };

    updatePaymentState(order.payment, {
      method: "CASH",
      paymentStatus: "PAID",
      paidAt: order.payment.paidAt ?? new Date().toISOString(),
      lastPaymentFailure: null,
    });

    appendPaymentAuditLog(order, "PAYMENT_PAID", before, {
      paymentStatus: order.payment.paymentStatus,
    });

    sendJson(response, 200, toPaymentDetail(order.payment));
    return;
  }

  const paymentRefundMatch = url.pathname.match(/^\/payments\/([^/]+)\/refund$/);

  if (paymentRefundMatch && request.method === "POST") {
    const order = findOrder(paymentRefundMatch[1]);

    if (!order || !order.payment) {
      sendJson(response, 404, { message: "Payment was not found" });
      return;
    }

    const body = await parseBody(request);

    if (!body.refundReason?.trim()) {
      sendJson(response, 400, { message: "Refund reason is required" });
      return;
    }

    if (order.payment.paymentStatus !== "PAID") {
      sendJson(response, 400, { message: "Only paid orders can be refunded" });
      return;
    }

    if (
      !["NONE", "FAILED"].includes(order.payment.refundStatus)
    ) {
      sendJson(response, 400, { message: "This payment is already in a refund flow" });
      return;
    }

    const requestedBefore = { refundStatus: order.payment.refundStatus };
    updatePaymentState(order.payment, {
      refundStatus: "REQUESTED",
      refundRequestedAt: new Date().toISOString(),
      refundReason: body.refundReason.trim(),
      lastRefundFailure: null,
    });
    appendPaymentAuditLog(order, "PAYMENT_REFUND_REQUESTED", requestedBefore, {
      refundStatus: order.payment.refundStatus,
    });

    const refundedBefore = { refundStatus: order.payment.refundStatus };
    updatePaymentState(order.payment, {
      refundStatus: "REFUNDED",
      refundedAt: new Date().toISOString(),
      refundFailedAt: null,
      stripeRefundId: `re_${Date.now()}`,
    });
    appendPaymentAuditLog(order, "PAYMENT_REFUNDED", refundedBefore, {
      refundStatus: order.payment.refundStatus,
    });

    if (order.status === "CONFIRMED") {
      const beforeStatus = order.status;
      order.status = "CANCELLED";
      order.cancelledAt = new Date().toISOString();
      appendAuditLog(order, "STATUS_CHANGE", { status: beforeStatus }, {
        status: order.status,
      });
    }

    sendJson(response, 200, toPaymentDetail(order.payment));
    return;
  }

  if (request.method === "GET" && url.pathname === "/audit-logs") {
    const entityType = getSearchParam(url, "entityType");
    const entityId = getSearchParam(url, "entityId");
    const order =
      entityType === "PAYMENT" && entityId
        ? findOrderByPaymentId(entityId)
        : entityId
          ? findOrder(entityId)
          : null;
    const logs =
      entityType === "PAYMENT"
        ? order?.payment?.auditLogs ?? []
        : order?.auditLogs ?? [];

    sendJson(response, 200, {
      data: clone(logs),
      totalCount: logs.length,
      nextCursor: undefined,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/team") {
    sendJson(response, 200, buildTeamMembersResponse(url));
    return;
  }

  if (request.method === "GET" && url.pathname === "/team/roles") {
    sendJson(response, 200, {
      data: clone(state.roles),
    });
    return;
  }

  const teamMemberMatch = url.pathname.match(/^\/team\/([^/]+)$/);

  if (teamMemberMatch && request.method === "GET") {
    const member = findTeamMember(teamMemberMatch[1]);

    if (!member) {
      sendJson(response, 404, { message: "Team member was not found" });
      return;
    }

    sendJson(response, 200, clone(member));
    return;
  }

  if (request.method === "POST" && url.pathname === "/team/invite") {
    const body = await parseBody(request);

    if (
      state.teamMembers.some(
        (member) => member.email.toLowerCase() === body.email.toLowerCase(),
      )
    ) {
      sendJson(response, 409, {
        message: "That email already has organization access or a pending invite.",
      });
      return;
    }

    const selectedLocations =
      body.locationIds?.length > 0
        ? state.locations
            .filter((location) => body.locationIds.includes(location.id))
            .map(createTeamLocation)
        : [];

    const member = {
      membershipId: `mem-${state.nextIds.teamMember++}`,
      userId: `user-${Date.now()}`,
      displayName: body.email,
      email: body.email,
      firstName: "",
      lastName: "",
      role: body.role,
      status: "INVITED",
      hasAllLocations: selectedLocations.length === 0,
      locations: selectedLocations,
      inviteExpired: false,
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: [],
      activity: [],
    };

    state.teamMembers.unshift(member);
    sendJson(response, 201, {
      member: clone(member),
      inviteUrl: `${frontendBaseUrl}/invite/${member.membershipId}-token`,
    });
    return;
  }

  if (teamMemberMatch && request.method === "PATCH") {
    const member = findTeamMember(teamMemberMatch[1]);

    if (!member) {
      sendJson(response, 404, { message: "Team member was not found" });
      return;
    }

    Object.assign(member, await parseBody(request), {
      displayName: [
        member.firstName,
        member.lastName,
      ]
        .filter(Boolean)
        .join(" ") || member.email,
      updatedAt: new Date().toISOString(),
    });
    sendJson(response, 200, { member: clone(member) });
    return;
  }

  const teamLocationsMatch = url.pathname.match(/^\/team\/([^/]+)\/locations$/);

  if (teamLocationsMatch && request.method === "PATCH") {
    const member = findTeamMember(teamLocationsMatch[1]);

    if (!member) {
      sendJson(response, 404, { message: "Team member was not found" });
      return;
    }

    const body = await parseBody(request);
    member.hasAllLocations = (body.locationIds?.length ?? 0) === 0;
    member.locations = member.hasAllLocations
      ? []
      : state.locations
          .filter((location) => body.locationIds.includes(location.id))
          .map(createTeamLocation);
    member.updatedAt = new Date().toISOString();
    sendJson(response, 200, { member: clone(member) });
    return;
  }

  const teamActionMatch = url.pathname.match(
    /^\/team\/([^/]+)\/(resend-invite|reactivate|deactivate)$/,
  );

  if (teamActionMatch && request.method === "POST") {
    const member = findTeamMember(teamActionMatch[1]);

    if (!member) {
      sendJson(response, 404, { message: "Team member was not found" });
      return;
    }

    const action = teamActionMatch[2];

    if (action === "resend-invite") {
      member.inviteExpired = false;
    }

    if (action === "reactivate") {
      member.status = "ACTIVE";
    }

    if (action === "deactivate") {
      member.status = "DEACTIVATED";
    }

    member.updatedAt = new Date().toISOString();
    sendJson(response, 200, { member: clone(member) });
    return;
  }

  const teamRoleMatch = url.pathname.match(/^\/team\/([^/]+)\/role$/);

  if (teamRoleMatch && request.method === "PATCH") {
    const member = findTeamMember(teamRoleMatch[1]);

    if (!member) {
      sendJson(response, 404, { message: "Team member was not found" });
      return;
    }

    const body = await parseBody(request);
    member.role = body.role;
    member.updatedAt = new Date().toISOString();
    sendJson(response, 200, { member: clone(member) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/team/invitations/resolve") {
    const body = await parseBody(request);
    const invitation = state.invitations[body.token];

    if (!invitation) {
      sendJson(response, 200, { status: "INVALID" });
      return;
    }

    sendJson(response, 200, clone(invitation));
    return;
  }

  if (request.method === "POST" && url.pathname === "/team/invitations/accept") {
    const body = await parseBody(request);
    const invitation = state.invitations[body.token];

    if (!invitation || invitation.status !== "VALID" || !invitation.member) {
      sendJson(response, 400, { message: "The invitation is no longer valid" });
      return;
    }

    if (invitation.requiresPassword && String(body.password ?? "").length < 8) {
      sendJson(response, 400, { message: "Password must be at least 8 characters" });
      return;
    }

    invitation.member.status = "ACTIVE";
    invitation.member.updatedAt = new Date().toISOString();

    const existing = state.teamMembers.find(
      (member) => member.membershipId === invitation.member.membershipId,
    );

    if (existing) {
      Object.assign(existing, invitation.member);
    } else {
      state.teamMembers.unshift(clone(invitation.member));
    }

    sendJson(response, 200, {
      message: "Invite accepted",
      member: clone(invitation.member),
    });
    return;
  }

  sendJson(response, 404, { message: `Unhandled route: ${request.method} ${url.pathname}` });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    sendJson(response, 500, { message: "Mock server error" });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock API server listening on http://127.0.0.1:${port}`);
});
