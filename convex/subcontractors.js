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
// Get subcontractor by ID
export var getById = query({
    args: { id: v.id("subcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get subcontractors by company
export var getByCompany = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("subcontractors")
                        .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get subcontractor by ABN within company
export var getByAbn = query({
    args: {
        companyId: v.id("companies"),
        abn: v.string(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("subcontractors")
                        .withIndex("by_abn", function (q) {
                        return q.eq("companyId", args.companyId).eq("abn", args.abn);
                    })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Search subcontractors by name
export var searchByName = query({
    args: {
        companyId: v.id("companies"),
        searchTerm: v.string(),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!args.searchTerm.trim()) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .query("subcontractors")
                            .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                            .take(100)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: return [4 /*yield*/, ctx.db
                        .query("subcontractors")
                        .withSearchIndex("search_name", function (q) {
                        return q.search("name", args.searchTerm).eq("companyId", args.companyId);
                    })
                        .take(100)];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Create subcontractor
export var create = mutation({
    args: {
        companyId: v.id("companies"),
        name: v.string(),
        abn: v.string(),
        acn: v.optional(v.string()),
        tradingName: v.optional(v.string()),
        address: v.optional(v.string()),
        trade: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        brokerName: v.optional(v.string()),
        brokerEmail: v.optional(v.string()),
        brokerPhone: v.optional(v.string()),
        workersCompState: v.optional(v.string()),
        portalAccess: v.optional(v.boolean()),
        portalUserId: v.optional(v.id("users")),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existingByAbn, subcontractorId;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("subcontractors")
                        .withIndex("by_abn", function (q) {
                        return q.eq("companyId", args.companyId).eq("abn", args.abn);
                    })
                        .first()];
                case 1:
                    existingByAbn = _c.sent();
                    if (existingByAbn) {
                        throw new Error("Subcontractor with this ABN already exists");
                    }
                    return [4 /*yield*/, ctx.db.insert("subcontractors", {
                            companyId: args.companyId,
                            name: args.name,
                            abn: args.abn,
                            acn: args.acn,
                            tradingName: args.tradingName,
                            address: args.address,
                            trade: args.trade,
                            contactName: args.contactName,
                            contactEmail: (_a = args.contactEmail) === null || _a === void 0 ? void 0 : _a.toLowerCase(),
                            contactPhone: args.contactPhone,
                            brokerName: args.brokerName,
                            brokerEmail: (_b = args.brokerEmail) === null || _b === void 0 ? void 0 : _b.toLowerCase(),
                            brokerPhone: args.brokerPhone,
                            workersCompState: args.workersCompState,
                            portalAccess: args.portalAccess || false,
                            portalUserId: args.portalUserId,
                            updatedAt: Date.now(),
                        })];
                case 2:
                    subcontractorId = _c.sent();
                    return [2 /*return*/, subcontractorId];
            }
        });
    }); },
});
// Update subcontractor
export var update = mutation({
    args: {
        id: v.id("subcontractors"),
        name: v.optional(v.string()),
        abn: v.optional(v.string()),
        acn: v.optional(v.string()),
        tradingName: v.optional(v.string()),
        address: v.optional(v.string()),
        trade: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactPhone: v.optional(v.string()),
        brokerName: v.optional(v.string()),
        brokerEmail: v.optional(v.string()),
        brokerPhone: v.optional(v.string()),
        workersCompState: v.optional(v.string()),
        portalAccess: v.optional(v.boolean()),
        portalUserId: v.optional(v.id("users")),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var id, updates, subcontractor, existingByAbn, filteredUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = args.id, updates = __rest(args, ["id"]);
                    return [4 /*yield*/, ctx.db.get(id)];
                case 1:
                    subcontractor = _a.sent();
                    if (!subcontractor)
                        throw new Error("Subcontractor not found");
                    if (!(updates.abn && updates.abn !== subcontractor.abn)) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.db
                            .query("subcontractors")
                            .withIndex("by_abn", function (q) {
                            return q.eq("companyId", subcontractor.companyId).eq("abn", updates.abn);
                        })
                            .first()];
                case 2:
                    existingByAbn = _a.sent();
                    if (existingByAbn && existingByAbn._id !== id) {
                        throw new Error("Subcontractor with this ABN already exists");
                    }
                    _a.label = 3;
                case 3:
                    // Normalize emails
                    if (updates.contactEmail) {
                        updates.contactEmail = updates.contactEmail.toLowerCase();
                    }
                    if (updates.brokerEmail) {
                        updates.brokerEmail = updates.brokerEmail.toLowerCase();
                    }
                    filteredUpdates = Object.fromEntries(Object.entries(updates).filter(function (_a) {
                        var _ = _a[0], v = _a[1];
                        return v !== undefined;
                    }));
                    return [4 /*yield*/, ctx.db.patch(id, __assign(__assign({}, filteredUpdates), { updatedAt: Date.now() }))];
                case 4:
                    _a.sent();
                    return [2 /*return*/, id];
            }
        });
    }); },
});
// Delete subcontractor
export var remove = mutation({
    args: { id: v.id("subcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Note: In a real app, you'd want to check for related data
                return [4 /*yield*/, ctx.db.delete(args.id)];
                case 1:
                    // Note: In a real app, you'd want to check for related data
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Get subcontractor count by company
export var getCount = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var subcontractors;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("subcontractors")
                        .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                        .collect()];
                case 1:
                    subcontractors = _a.sent();
                    return [2 /*return*/, subcontractors.length];
            }
        });
    }); },
});
// Enable/disable portal access
export var setPortalAccess = mutation({
    args: {
        id: v.id("subcontractors"),
        portalAccess: v.boolean(),
        portalUserId: v.optional(v.id("users")),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        portalAccess: args.portalAccess,
                        portalUserId: args.portalUserId,
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
