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
// Get company by ID
export var getById = query({
    args: { id: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get company by ABN
export var getByAbn = query({
    args: { abn: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("companies")
                        .withIndex("by_abn", function (q) { return q.eq("abn", args.abn); })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get company by forwarding email
export var getByForwardingEmail = query({
    args: { email: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("companies")
                        .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", args.email.toLowerCase()); })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Create company
export var create = mutation({
    args: {
        name: v.string(),
        abn: v.string(),
        acn: v.optional(v.string()),
        logoUrl: v.optional(v.string()),
        address: v.optional(v.string()),
        primaryContactName: v.optional(v.string()),
        primaryContactEmail: v.optional(v.string()),
        primaryContactPhone: v.optional(v.string()),
        forwardingEmail: v.optional(v.string()),
        settings: v.optional(v.any()),
        subscriptionTier: v.optional(v.string()),
        subscriptionStatus: v.optional(v.string()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existingByAbn, existingByEmail, companyId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("companies")
                        .withIndex("by_abn", function (q) { return q.eq("abn", args.abn); })
                        .first()];
                case 1:
                    existingByAbn = _b.sent();
                    if (existingByAbn) {
                        throw new Error("Company with this ABN already exists");
                    }
                    if (!args.forwardingEmail) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.db
                            .query("companies")
                            .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", args.forwardingEmail.toLowerCase()); })
                            .first()];
                case 2:
                    existingByEmail = _b.sent();
                    if (existingByEmail) {
                        throw new Error("Forwarding email already in use");
                    }
                    _b.label = 3;
                case 3: return [4 /*yield*/, ctx.db.insert("companies", {
                        name: args.name,
                        abn: args.abn,
                        acn: args.acn,
                        logoUrl: args.logoUrl,
                        address: args.address,
                        primaryContactName: args.primaryContactName,
                        primaryContactEmail: args.primaryContactEmail,
                        primaryContactPhone: args.primaryContactPhone,
                        forwardingEmail: (_a = args.forwardingEmail) === null || _a === void 0 ? void 0 : _a.toLowerCase(),
                        settings: args.settings || {},
                        subscriptionTier: args.subscriptionTier || "trial",
                        subscriptionStatus: args.subscriptionStatus || "active",
                        updatedAt: Date.now(),
                    })];
                case 4:
                    companyId = _b.sent();
                    return [2 /*return*/, companyId];
            }
        });
    }); },
});
// Update company
export var update = mutation({
    args: {
        id: v.id("companies"),
        name: v.optional(v.string()),
        abn: v.optional(v.string()),
        acn: v.optional(v.string()),
        logoUrl: v.optional(v.string()),
        address: v.optional(v.string()),
        primaryContactName: v.optional(v.string()),
        primaryContactEmail: v.optional(v.string()),
        primaryContactPhone: v.optional(v.string()),
        forwardingEmail: v.optional(v.string()),
        settings: v.optional(v.any()),
        subscriptionTier: v.optional(v.string()),
        subscriptionStatus: v.optional(v.string()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var id, updates, existingByAbn, existingByEmail, filteredUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = args.id, updates = __rest(args
                    // If updating ABN, check it's not already in use
                    , ["id"]);
                    if (!updates.abn) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .query("companies")
                            .withIndex("by_abn", function (q) { return q.eq("abn", updates.abn); })
                            .first()];
                case 1:
                    existingByAbn = _a.sent();
                    if (existingByAbn && existingByAbn._id !== id) {
                        throw new Error("Company with this ABN already exists");
                    }
                    _a.label = 2;
                case 2:
                    if (!updates.forwardingEmail) return [3 /*break*/, 4];
                    return [4 /*yield*/, ctx.db
                            .query("companies")
                            .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", updates.forwardingEmail.toLowerCase()); })
                            .first()];
                case 3:
                    existingByEmail = _a.sent();
                    if (existingByEmail && existingByEmail._id !== id) {
                        throw new Error("Forwarding email already in use");
                    }
                    updates.forwardingEmail = updates.forwardingEmail.toLowerCase();
                    _a.label = 4;
                case 4:
                    filteredUpdates = Object.fromEntries(Object.entries(updates).filter(function (_a) {
                        var _ = _a[0], v = _a[1];
                        return v !== undefined;
                    }));
                    return [4 /*yield*/, ctx.db.patch(id, __assign(__assign({}, filteredUpdates), { updatedAt: Date.now() }))];
                case 5:
                    _a.sent();
                    return [2 /*return*/, id];
            }
        });
    }); },
});
// Delete company (with cascade)
export var remove = mutation({
    args: { id: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Note: In a real app, you'd want to cascade delete or check for related data
                // For now, we just delete the company
                return [4 /*yield*/, ctx.db.delete(args.id)];
                case 1:
                    // Note: In a real app, you'd want to cascade delete or check for related data
                    // For now, we just delete the company
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Update company settings
export var updateSettings = mutation({
    args: {
        id: v.id("companies"),
        settings: v.any(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var company, mergedSettings;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    company = _a.sent();
                    if (!company)
                        throw new Error("Company not found");
                    mergedSettings = __assign(__assign({}, (company.settings || {})), args.settings);
                    return [4 /*yield*/, ctx.db.patch(args.id, {
                            settings: mergedSettings,
                            updatedAt: Date.now(),
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Update subscription
export var updateSubscription = mutation({
    args: {
        id: v.id("companies"),
        subscriptionTier: v.string(),
        subscriptionStatus: v.string(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        subscriptionTier: args.subscriptionTier,
                        subscriptionStatus: args.subscriptionStatus,
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
