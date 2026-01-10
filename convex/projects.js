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
// Australian state type validator
var australianState = v.union(v.literal("NSW"), v.literal("VIC"), v.literal("QLD"), v.literal("WA"), v.literal("SA"), v.literal("TAS"), v.literal("NT"), v.literal("ACT"));
// Project status type validator
var projectStatus = v.union(v.literal("active"), v.literal("completed"), v.literal("on_hold"));
// Get project by ID
export var getById = query({
    args: { id: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get project by ID with company data
export var getByIdWithCompany = query({
    args: { id: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var project, company;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    project = _a.sent();
                    if (!project)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, ctx.db.get(project.companyId)];
                case 2:
                    company = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, project), { company: company })];
            }
        });
    }); },
});
// Get projects by company
export var getByCompany = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                        .order("desc")
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get projects by company and status
export var getByCompanyAndStatus = query({
    args: {
        companyId: v.id("companies"),
        status: projectStatus,
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_status", function (q) {
                        return q.eq("companyId", args.companyId).eq("status", args.status);
                    })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get active projects by company
export var getActiveByCompany = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_status", function (q) {
                        return q.eq("companyId", args.companyId).eq("status", "active");
                    })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get projects by project manager
export var getByManager = query({
    args: { projectManagerId: v.id("users") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_manager", function (q) { return q.eq("projectManagerId", args.projectManagerId); })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get project by forwarding email
export var getByForwardingEmail = query({
    args: { email: v.string() },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", args.email.toLowerCase()); })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Create project
export var create = mutation({
    args: {
        companyId: v.id("companies"),
        name: v.string(),
        address: v.optional(v.string()),
        state: v.optional(australianState),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        estimatedValue: v.optional(v.number()),
        projectManagerId: v.optional(v.id("users")),
        forwardingEmail: v.optional(v.string()),
        status: v.optional(projectStatus),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existingByEmail, projectId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!args.forwardingEmail) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .query("projects")
                            .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", args.forwardingEmail.toLowerCase()); })
                            .first()];
                case 1:
                    existingByEmail = _b.sent();
                    if (existingByEmail) {
                        throw new Error("Forwarding email already in use");
                    }
                    _b.label = 2;
                case 2: return [4 /*yield*/, ctx.db.insert("projects", {
                        companyId: args.companyId,
                        name: args.name,
                        address: args.address,
                        state: args.state,
                        startDate: args.startDate,
                        endDate: args.endDate,
                        estimatedValue: args.estimatedValue,
                        projectManagerId: args.projectManagerId,
                        forwardingEmail: (_a = args.forwardingEmail) === null || _a === void 0 ? void 0 : _a.toLowerCase(),
                        status: args.status || "active",
                        updatedAt: Date.now(),
                    })];
                case 3:
                    projectId = _b.sent();
                    return [2 /*return*/, projectId];
            }
        });
    }); },
});
// Update project
export var update = mutation({
    args: {
        id: v.id("projects"),
        name: v.optional(v.string()),
        address: v.optional(v.string()),
        state: v.optional(australianState),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        estimatedValue: v.optional(v.number()),
        projectManagerId: v.optional(v.id("users")),
        forwardingEmail: v.optional(v.string()),
        status: v.optional(projectStatus),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var id, updates, existingByEmail, filteredUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = args.id, updates = __rest(args
                    // If updating forwarding email, check it's not already in use
                    , ["id"]);
                    if (!updates.forwardingEmail) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .query("projects")
                            .withIndex("by_forwarding_email", function (q) { return q.eq("forwardingEmail", updates.forwardingEmail.toLowerCase()); })
                            .first()];
                case 1:
                    existingByEmail = _a.sent();
                    if (existingByEmail && existingByEmail._id !== id) {
                        throw new Error("Forwarding email already in use");
                    }
                    updates.forwardingEmail = updates.forwardingEmail.toLowerCase();
                    _a.label = 2;
                case 2:
                    filteredUpdates = Object.fromEntries(Object.entries(updates).filter(function (_a) {
                        var _ = _a[0], v = _a[1];
                        return v !== undefined;
                    }));
                    return [4 /*yield*/, ctx.db.patch(id, __assign(__assign({}, filteredUpdates), { updatedAt: Date.now() }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/, id];
            }
        });
    }); },
});
// Delete project
export var remove = mutation({
    args: { id: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Note: In a real app, you'd want to cascade delete related data
                return [4 /*yield*/, ctx.db.delete(args.id)];
                case 1:
                    // Note: In a real app, you'd want to cascade delete related data
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Get project stats for dashboard
export var getStats = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var projects, stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_company", function (q) { return q.eq("companyId", args.companyId); })
                        .collect()];
                case 1:
                    projects = _a.sent();
                    stats = {
                        total: projects.length,
                        active: projects.filter(function (p) { return p.status === "active"; }).length,
                        completed: projects.filter(function (p) { return p.status === "completed"; }).length,
                        onHold: projects.filter(function (p) { return p.status === "on_hold"; }).length,
                    };
                    return [2 /*return*/, stats];
            }
        });
    }); },
});
