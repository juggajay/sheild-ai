var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
// Role type validator
var userRole = v.union(v.literal("admin"), v.literal("risk_manager"), v.literal("project_manager"), v.literal("project_administrator"), v.literal("read_only"), v.literal("subcontractor"), v.literal("broker"));
// Get user by ID
export var getById = query({
    args: { id: v.id("users") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    user = _a.sent();
                    if (!user)
                        return [2 /*return*/, null
                            // Don't return password hash
                        ];
                    // Don't return password hash
                    return [2 /*return*/, __assign(__assign({}, user), { passwordHash: undefined })];
            }
        });
    }); },
});
// Get user by email
export var getByEmail = query({
    args: { email: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("users")
                        .withIndex("by_email", function (q) { return q.eq("email", args.email.toLowerCase()); })
                        .first()];
                case 1:
                    user = _a.sent();
                    return [2 /*return*/, user];
            }
        });
    }); },
});
// Get user by email (internal - includes password hash for auth)
export var getByEmailInternal = query({
    args: { email: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("users")
                        .withIndex("by_email", function (q) { return q.eq("email", args.email.toLowerCase()); })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get users by company
export var getByCompany = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var users;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("users")
                        .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                        .collect()];
                case 1:
                    users = _a.sent();
                    return [2 /*return*/, users.map(function (user) { return (__assign(__assign({}, user), { passwordHash: undefined })); })];
            }
        });
    }); },
});
// Create user
export var create = mutation({
    args: {
        companyId: v.optional(v.id("companies")),
        email: v.string(),
        passwordHash: v.string(),
        name: v.string(),
        phone: v.optional(v.string()),
        role: userRole,
        avatarUrl: v.optional(v.string()),
        notificationPreferences: v.optional(v.any()),
        invitationStatus: v.optional(v.string()),
        invitationToken: v.optional(v.string()),
        invitationExpiresAt: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existing, userId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("users")
                        .withIndex("by_email", function (q) { return q.eq("email", args.email.toLowerCase()); })
                        .first()];
                case 1:
                    existing = _a.sent();
                    if (existing) {
                        throw new Error("Email already registered");
                    }
                    return [4 /*yield*/, ctx.db.insert("users", {
                            companyId: args.companyId,
                            email: args.email.toLowerCase(),
                            passwordHash: args.passwordHash,
                            name: args.name,
                            phone: args.phone,
                            role: args.role,
                            avatarUrl: args.avatarUrl,
                            notificationPreferences: args.notificationPreferences || {},
                            invitationStatus: args.invitationStatus || "accepted",
                            invitationToken: args.invitationToken,
                            invitationExpiresAt: args.invitationExpiresAt,
                            lastLoginAt: undefined,
                            updatedAt: Date.now(),
                        })];
                case 2:
                    userId = _a.sent();
                    return [2 /*return*/, userId];
            }
        });
    }); },
});
// Update user
export var update = mutation({
    args: {
        id: v.id("users"),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        role: v.optional(userRole),
        avatarUrl: v.optional(v.string()),
        notificationPreferences: v.optional(v.any()),
        invitationStatus: v.optional(v.string()),
        invitationToken: v.optional(v.string()),
        invitationExpiresAt: v.optional(v.number()),
        lastLoginAt: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var id, updates, filteredUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = args.id, updates = __rest(args
                    // Filter out undefined values
                    , ["id"]);
                    filteredUpdates = Object.fromEntries(Object.entries(updates).filter(function (_a) {
                        var _ = _a[0], v = _a[1];
                        return v !== undefined;
                    }));
                    return [4 /*yield*/, ctx.db.patch(id, __assign(__assign({}, filteredUpdates), { updatedAt: Date.now() }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, id];
            }
        });
    }); },
});
// Update password
export var updatePassword = mutation({
    args: {
        id: v.id("users"),
        passwordHash: v.string(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        passwordHash: args.passwordHash,
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Update last login
export var updateLastLogin = mutation({
    args: { id: v.id("users") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        lastLoginAt: Date.now(),
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Delete user
export var remove = mutation({
    args: { id: v.id("users") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var sessions, _i, sessions_1, session;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("sessions")
                        .withIndex("by_user", function (q) { return q.eq("userId", args.id); })
                        .collect()];
                case 1:
                    sessions = _a.sent();
                    _i = 0, sessions_1 = sessions;
                    _a.label = 2;
                case 2:
                    if (!(_i < sessions_1.length)) return [3 /*break*/, 5];
                    session = sessions_1[_i];
                    return [4 /*yield*/, ctx.db.delete(session._id)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: 
                // Delete the user
                return [4 /*yield*/, ctx.db.delete(args.id)];
                case 6:
                    // Delete the user
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Get user by invitation token
export var getByInvitationToken = query({
    args: { token: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("users")
                        .withIndex("by_invitation_token", function (q) { return q.eq("invitationToken", args.token); })
                        .first()];
                case 1:
                    user = _a.sent();
                    if (!user)
                        return [2 /*return*/, null];
                    if (user.invitationExpiresAt && user.invitationExpiresAt < Date.now()) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, __assign(__assign({}, user), { passwordHash: undefined })];
            }
        });
    }); },
});
// Accept invitation
export var acceptInvitation = mutation({
    args: {
        id: v.id("users"),
        passwordHash: v.string(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        passwordHash: args.passwordHash,
                        invitationStatus: "accepted",
                        invitationToken: undefined,
                        invitationExpiresAt: undefined,
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
