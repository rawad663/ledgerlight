const NOW = new Date("2026-04-08T15:00:00.000Z");

function isoDays(offsetDays, hour = 15) {
  const next = new Date(NOW);
  next.setUTCDate(next.getUTCDate() + offsetDays);
  next.setUTCHours(hour, 0, 0, 0);
  return next.toISOString();
}

function isoHours(offsetHours) {
  const next = new Date(NOW);
  next.setUTCHours(next.getUTCHours() + offsetHours, 0, 0, 0);
  return next.toISOString();
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function createAccessToken({ user, memberships, expiresInSeconds = 3600 }) {
  const issuedAt = Math.floor(NOW.getTime() / 1000);

  return [
    "header",
    encodePayload({
      sub: user.id,
      user,
      memberships,
      iat: issuedAt,
      exp: issuedAt + expiresInSeconds,
    }),
    "signature",
  ].join(".");
}

function createTeamLocation(location) {
  return {
    id: location.id,
    name: location.name,
  };
}

function createBaseData() {
  const organization = {
    id: "org-1",
    name: "Ledger Light",
  };

  const locations = [
    {
      id: "loc-1",
      organizationId: organization.id,
      name: "Toronto Flagship",
      code: "TOR-1",
      type: "STORE",
      status: "ACTIVE",
      addressLine1: "123 Queen St W",
      addressLine2: "",
      city: "Toronto",
      stateProvince: "ON",
      postalCode: "M5H 2M9",
      countryCode: "CA",
      notes: "Primary retail storefront",
      createdAt: isoDays(-40),
      updatedAt: isoDays(-2),
    },
    {
      id: "loc-2",
      organizationId: organization.id,
      name: "Montreal Warehouse",
      code: "MTL-1",
      type: "WAREHOUSE",
      status: "ACTIVE",
      addressLine1: "500 Rue du Port",
      addressLine2: "",
      city: "Montreal",
      stateProvince: "QC",
      postalCode: "H2Y 1C6",
      countryCode: "CA",
      notes: "Bulk inventory and transfers",
      createdAt: isoDays(-32),
      updatedAt: isoDays(-5),
    },
    {
      id: "loc-3",
      organizationId: organization.id,
      name: "Pop-up Archive",
      code: "POP-9",
      type: "POP_UP",
      status: "ARCHIVED",
      addressLine1: "22 Festival Ave",
      addressLine2: "",
      city: "Toronto",
      stateProvince: "ON",
      postalCode: "M6K 1A1",
      countryCode: "CA",
      notes: "Archived seasonal kiosk",
      createdAt: isoDays(-90),
      updatedAt: isoDays(-20),
    },
  ];

  const teamUsers = {
    owner: {
      id: "user-owner",
      email: "owner@example.com",
      firstName: "Olivia",
      lastName: "Owner",
      active: true,
      createdAt: isoDays(-180),
      updatedAt: isoDays(-1),
      lastLoginAt: isoHours(-4),
    },
    manager: {
      id: "user-manager",
      email: "manager@example.com",
      firstName: "Manny",
      lastName: "Manager",
      active: true,
      createdAt: isoDays(-120),
      updatedAt: isoDays(-1),
      lastLoginAt: isoHours(-10),
    },
    cashier: {
      id: "user-cashier",
      email: "cashier@example.com",
      firstName: "Casey",
      lastName: "Cashier",
      active: true,
      createdAt: isoDays(-80),
      updatedAt: isoDays(-2),
      lastLoginAt: isoHours(-24),
    },
    existingInvite: {
      id: "user-existing-invite",
      email: "existing@example.com",
      firstName: "Elliot",
      lastName: "Existing",
      isActive: true,
      createdAt: isoDays(-70),
      updatedAt: isoDays(-1),
      lastLoginAt: isoHours(-8),
    },
  };

  const memberships = [
    {
      id: "mem-owner",
      userId: teamUsers.owner.id,
      organizationId: organization.id,
      organizationName: organization.name,
      role: "OWNER",
      hasAllLocations: true,
      allowedLocationIds: [],
      status: "ACTIVE",
    },
    {
      id: "mem-manager",
      userId: teamUsers.manager.id,
      organizationId: organization.id,
      organizationName: organization.name,
      role: "MANAGER",
      hasAllLocations: false,
      allowedLocationIds: ["loc-1", "loc-2"],
      status: "ACTIVE",
    },
    {
      id: "mem-cashier",
      userId: teamUsers.cashier.id,
      organizationId: organization.id,
      organizationName: organization.name,
      role: "CASHIER",
      hasAllLocations: false,
      allowedLocationIds: ["loc-1"],
      status: "ACTIVE",
    },
    {
      id: "mem-existing",
      userId: teamUsers.existingInvite.id,
      organizationId: organization.id,
      organizationName: organization.name,
      role: "SUPPORT",
      hasAllLocations: true,
      allowedLocationIds: [],
      status: "ACTIVE",
    },
  ];

  const products = [
    {
      id: "prod-1",
      organizationId: organization.id,
      name: "Essential Tee",
      sku: "TEE-001",
      category: "Apparel",
      priceCents: 2500,
      reorderThreshold: 10,
      active: true,
      createdAt: isoDays(-40),
      updatedAt: isoDays(-2),
    },
    {
      id: "prod-2",
      organizationId: organization.id,
      name: "Coffee Beans",
      sku: "COF-001",
      category: "Pantry",
      priceCents: 1800,
      reorderThreshold: 5,
      active: true,
      createdAt: isoDays(-50),
      updatedAt: isoDays(-3),
    },
    {
      id: "prod-3",
      organizationId: organization.id,
      name: "Sticker Pack",
      sku: "STK-001",
      category: "Merch",
      priceCents: 500,
      reorderThreshold: 20,
      active: true,
      createdAt: isoDays(-20),
      updatedAt: isoDays(-1),
    },
  ];

  const inventoryLevels = [
    {
      id: "inv-1",
      organizationId: organization.id,
      productId: "prod-1",
      locationId: "loc-1",
      quantity: 4,
      updatedAt: isoDays(-1),
    },
    {
      id: "inv-2",
      organizationId: organization.id,
      productId: "prod-1",
      locationId: "loc-2",
      quantity: 9,
      updatedAt: isoDays(-1),
    },
    {
      id: "inv-3",
      organizationId: organization.id,
      productId: "prod-2",
      locationId: "loc-1",
      quantity: 12,
      updatedAt: isoDays(-1),
    },
    {
      id: "inv-4",
      organizationId: organization.id,
      productId: "prod-3",
      locationId: "loc-1",
      quantity: 50,
      updatedAt: isoDays(-1),
    },
  ];

  const customers = [
    {
      id: "cust-1",
      organizationId: organization.id,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "416-555-0100",
      status: "ACTIVE",
      internalNote: "VIP customer",
      orderCount: 3,
      lifetimeSpendCents: 9200,
      averageOrderValueCents: 3067,
      lastOrderAt: isoDays(-1),
      createdAt: isoDays(-60),
      updatedAt: isoDays(-1),
    },
    {
      id: "cust-2",
      organizationId: organization.id,
      name: "Sam Carter",
      email: "sam@example.com",
      phone: "514-555-0142",
      status: "ACTIVE",
      internalNote: "",
      orderCount: 1,
      lifetimeSpendCents: 3600,
      averageOrderValueCents: 3600,
      lastOrderAt: isoDays(-3),
      createdAt: isoDays(-55),
      updatedAt: isoDays(-3),
    },
  ];

  const orders = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      organizationId: organization.id,
      customerId: "cust-1",
      locationId: "loc-1",
      status: "PENDING",
      subtotalCents: 2500,
      discountCents: 0,
      taxCents: 325,
      totalCents: 2825,
      createdAt: isoDays(-1, 11),
      updatedAt: isoDays(-1, 11),
      placedAt: isoDays(-1, 11),
      cancelledAt: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Essential Tee",
          sku: "TEE-001",
          qty: 1,
          unitPriceCents: 2500,
          discountCents: 0,
          taxCents: 325,
          subtotalCents: 2500,
          totalCents: 2825,
        },
      ],
      auditLogs: [
        {
          id: "audit-1",
          entityType: "ORDER",
          entityId: "11111111-1111-1111-1111-111111111111",
          action: "CREATE",
          createdAt: isoDays(-1, 11),
          actor: {
            id: teamUsers.owner.id,
            firstName: teamUsers.owner.firstName,
            lastName: teamUsers.owner.lastName,
            email: teamUsers.owner.email,
          },
          beforeJson: null,
          afterJson: { status: "PENDING" },
        },
      ],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: organization.id,
      customerId: "cust-2",
      locationId: "loc-2",
      status: "CONFIRMED",
      subtotalCents: 3600,
      discountCents: 0,
      taxCents: 468,
      totalCents: 4068,
      createdAt: isoDays(-3, 14),
      updatedAt: isoDays(-3, 14),
      placedAt: isoDays(-3, 14),
      cancelledAt: null,
      items: [
        {
          id: "item-2",
          productId: "prod-2",
          productName: "Coffee Beans",
          sku: "COF-001",
          qty: 2,
          unitPriceCents: 1800,
          discountCents: 0,
          taxCents: 468,
          subtotalCents: 3600,
          totalCents: 4068,
        },
      ],
      auditLogs: [
        {
          id: "audit-2",
          entityType: "ORDER",
          entityId: "22222222-2222-2222-2222-222222222222",
          action: "STATUS_CHANGE",
          createdAt: isoDays(-2, 15),
          actor: {
            id: teamUsers.manager.id,
            firstName: teamUsers.manager.firstName,
            lastName: teamUsers.manager.lastName,
            email: teamUsers.manager.email,
          },
          beforeJson: { status: "PENDING" },
          afterJson: { status: "CONFIRMED" },
        },
      ],
    },
  ];

  const teamMembers = [
    {
      membershipId: "mem-owner",
      userId: teamUsers.owner.id,
      displayName: "Olivia Owner",
      email: teamUsers.owner.email,
      firstName: teamUsers.owner.firstName,
      lastName: teamUsers.owner.lastName,
      role: "OWNER",
      status: "ACTIVE",
      hasAllLocations: true,
      locations: locations
        .filter((location) => location.status === "ACTIVE")
        .map(createTeamLocation),
      inviteExpired: false,
      lastActiveAt: isoHours(-4),
      createdAt: isoDays(-180),
      updatedAt: isoDays(-1),
      permissions: ["*"],
      activity: [],
    },
    {
      membershipId: "mem-manager",
      userId: teamUsers.manager.id,
      displayName: "Manny Manager",
      email: teamUsers.manager.email,
      firstName: teamUsers.manager.firstName,
      lastName: teamUsers.manager.lastName,
      role: "MANAGER",
      status: "ACTIVE",
      hasAllLocations: false,
      locations: locations
        .filter((location) => ["loc-1", "loc-2"].includes(location.id))
        .map(createTeamLocation),
      inviteExpired: false,
      lastActiveAt: isoHours(-10),
      createdAt: isoDays(-120),
      updatedAt: isoDays(-1),
      permissions: ["team.read", "team.write"],
      activity: [],
    },
    {
      membershipId: "mem-cashier",
      userId: teamUsers.cashier.id,
      displayName: "Casey Cashier",
      email: teamUsers.cashier.email,
      firstName: teamUsers.cashier.firstName,
      lastName: teamUsers.cashier.lastName,
      role: "CASHIER",
      status: "ACTIVE",
      hasAllLocations: false,
      locations: [createTeamLocation(locations[0])],
      inviteExpired: false,
      lastActiveAt: isoHours(-24),
      createdAt: isoDays(-80),
      updatedAt: isoDays(-2),
      permissions: ["orders.read", "orders.write"],
      activity: [],
    },
    {
      membershipId: "mem-pending",
      userId: "user-pending",
      displayName: "Pat Pending",
      email: "pending@example.com",
      firstName: "Pat",
      lastName: "Pending",
      role: "SUPPORT",
      status: "INVITED",
      hasAllLocations: false,
      locations: [createTeamLocation(locations[0])],
      inviteExpired: false,
      lastActiveAt: null,
      createdAt: isoDays(-2),
      updatedAt: isoDays(-1),
      permissions: ["support.read"],
      activity: [],
    },
  ];

  const roles = [
    {
      role: "OWNER",
      tier: 1,
      memberCount: 1,
      summary: "Full business control",
      description: "Owners can manage billing, membership access, and every operational workflow.",
      permissions: ["*"],
    },
    {
      role: "MANAGER",
      tier: 2,
      memberCount: 1,
      summary: "Manage daily operations",
      description: "Managers can coordinate orders, inventory, customers, and team operations.",
      permissions: ["orders.read", "orders.write", "inventory.write", "team.write"],
    },
    {
      role: "CASHIER",
      tier: 3,
      memberCount: 1,
      summary: "Handle front-of-house activity",
      description: "Cashiers can create and update orders at assigned locations.",
      permissions: ["orders.read", "orders.write"],
    },
    {
      role: "SUPPORT",
      tier: 4,
      memberCount: 1,
      summary: "Respond to customer issues",
      description: "Support can review customers, orders, and invite status.",
      permissions: ["customers.read", "orders.read"],
    },
  ];

  const sessions = {
    owner: {
      userId: teamUsers.owner.id,
      organizationId: organization.id,
      accessToken: createAccessToken({
        user: teamUsers.owner,
        memberships: [memberships[0]],
      }),
      refreshToken: "refresh-owner",
    },
    ownerExpired: {
      userId: teamUsers.owner.id,
      organizationId: organization.id,
      accessToken: createAccessToken({
        user: teamUsers.owner,
        memberships: [memberships[0]],
        expiresInSeconds: -60,
      }),
      refreshToken: "refresh-owner",
    },
    cashier: {
      userId: teamUsers.cashier.id,
      organizationId: organization.id,
      accessToken: createAccessToken({
        user: teamUsers.cashier,
        memberships: [memberships[2]],
      }),
      refreshToken: "refresh-cashier",
    },
    existingInviteUser: {
      userId: teamUsers.existingInvite.id,
      organizationId: organization.id,
      accessToken: createAccessToken({
        user: teamUsers.existingInvite,
        memberships: [memberships[3]],
      }),
      refreshToken: "refresh-existing",
    },
  };

  const refreshTokens = {
    [sessions.owner.refreshToken]: {
      userId: sessions.owner.userId,
      nextAccessToken: createAccessToken({
        user: teamUsers.owner,
        memberships: [memberships[0]],
      }),
      user: teamUsers.owner,
    },
    [sessions.cashier.refreshToken]: {
      userId: sessions.cashier.userId,
      nextAccessToken: createAccessToken({
        user: teamUsers.cashier,
        memberships: [memberships[2]],
      }),
      user: teamUsers.cashier,
    },
    [sessions.existingInviteUser.refreshToken]: {
      userId: sessions.existingInviteUser.userId,
      nextAccessToken: createAccessToken({
        user: teamUsers.existingInvite,
        memberships: [memberships[3]],
      }),
      user: teamUsers.existingInvite,
    },
  };

  const authUsers = [
    {
      email: teamUsers.owner.email,
      password: "password123",
      sessionKey: "owner",
      user: teamUsers.owner,
      memberships: [memberships[0]],
    },
    {
      email: teamUsers.cashier.email,
      password: "password123",
      sessionKey: "cashier",
      user: teamUsers.cashier,
      memberships: [memberships[2]],
    },
  ];

  const invitations = {
    "expired-token": {
      status: "EXPIRED",
    },
    "new-user-token": {
      status: "VALID",
      organizationName: organization.name,
      roleDescription: "Manager access across operations.",
      requiresPassword: true,
      member: {
        membershipId: "mem-new-user",
        userId: "user-new-user",
        displayName: "Taylor New",
        email: "newuser@example.com",
        firstName: "Taylor",
        lastName: "New",
        role: "MANAGER",
        status: "INVITED",
        hasAllLocations: true,
        locations: [],
        inviteExpired: false,
        lastActiveAt: null,
        createdAt: isoDays(-1),
        updatedAt: isoDays(-1),
        permissions: ["orders.read", "orders.write"],
        activity: [],
      },
    },
    "existing-user-token": {
      status: "VALID",
      organizationName: organization.name,
      roleDescription: "Support access to customer and order workflows.",
      requiresPassword: false,
      member: {
        membershipId: "mem-existing-invite",
        userId: teamUsers.existingInvite.id,
        displayName: "Elliot Existing",
        email: teamUsers.existingInvite.email,
        firstName: teamUsers.existingInvite.firstName,
        lastName: teamUsers.existingInvite.lastName,
        role: "SUPPORT",
        status: "INVITED",
        hasAllLocations: false,
        locations: [createTeamLocation(locations[0])],
        inviteExpired: false,
        lastActiveAt: null,
        createdAt: isoDays(-1),
        updatedAt: isoDays(-1),
        permissions: ["customers.read", "orders.read"],
        activity: [],
      },
    },
  };

  return {
    organization,
    locations,
    memberships,
    teamUsers,
    products,
    inventoryLevels,
    customers,
    orders,
    teamMembers,
    roles,
    sessions,
    refreshTokens,
    authUsers,
    invitations,
    nextIds: {
      customer: 3,
      product: 4,
      location: 4,
      order: 3,
      item: 3,
      teamMember: 5,
      audit: 3,
    },
  };
}

export function buildScenario(name = "full-app") {
  const state = createBaseData();

  if (name === "auth-refresh-fail") {
    delete state.refreshTokens[state.sessions.owner.refreshToken];
  }

  if (name === "team-reactivate") {
    const manager = state.teamMembers.find(
      (member) => member.membershipId === "mem-manager",
    );

    if (manager) {
      manager.status = "DEACTIVATED";
      manager.updatedAt = NOW.toISOString();
    }
  }

  return state;
}
