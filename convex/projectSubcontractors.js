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
// Compliance status type validator
var complianceStatus = v.union(v.literal("pending"), v.literal("compliant"), v.literal("non_compliant"), v.literal("exception"));
// Get project-subcontractor link by ID
export var getById = query({
    args: { id: v.id("projectSubcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get project-subcontractor link with full data
export var getByIdWithDetails = query({
    args: { id: v.id("projectSubcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var ps, _a, project, subcontractor;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    ps = _b.sent();
                    if (!ps)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, Promise.all([
                            ctx.db.get(ps.projectId),
                            ctx.db.get(ps.subcontractorId),
                        ])];
                case 2:
                    _a = _b.sent(), project = _a[0], subcontractor = _a[1];
                    return [2 /*return*/, __assign(__assign({}, ps), { project: project, subcontractor: subcontractor })];
            }
        });
    }); },
});
// Get all subcontractors for a project
export var getByProject = query({
    args: { projectId: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var links, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .collect()
                    // Get subcontractor details for each link
                ];
                case 1:
                    links = _a.sent();
                    return [4 /*yield*/, Promise.all(links.map(function (link) { return __awaiter(void 0, void 0, void 0, function () {
                            var subcontractor;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, ctx.db.get(link.subcontractorId)];
                                    case 1:
                                        subcontractor = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, link), { subcontractor: subcontractor })];
                                }
                            });
                        }); }))];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results];
            }
        });
    }); },
});
// Get all projects for a subcontractor
export var getBySubcontractor = query({
    args: { subcontractorId: v.id("subcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var links, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_subcontractor", function (q) { return q.eq("subcontractorId", args.subcontractorId); })
                        .collect()
                    // Get project details for each link
                ];
                case 1:
                    links = _a.sent();
                    return [4 /*yield*/, Promise.all(links.map(function (link) { return __awaiter(void 0, void 0, void 0, function () {
                            var project;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, ctx.db.get(link.projectId)];
                                    case 1:
                                        project = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, link), { project: project })];
                                }
                            });
                        }); }))];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results];
            }
        });
    }); },
});
// Get specific project-subcontractor link
export var getByProjectAndSubcontractor = query({
    args: {
        projectId: v.id("projects"),
        subcontractorId: v.id("subcontractors"),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_project_subcontractor", function (q) {
                        return q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId);
                    })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get subcontractors by project and status
export var getByProjectAndStatus = query({
    args: {
        projectId: v.id("projects"),
        status: complianceStatus,
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var links, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_status", function (q) {
                        return q.eq("projectId", args.projectId).eq("status", args.status);
                    })
                        .collect()
                    // Get subcontractor details
                ];
                case 1:
                    links = _a.sent();
                    return [4 /*yield*/, Promise.all(links.map(function (link) { return __awaiter(void 0, void 0, void 0, function () {
                            var subcontractor;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, ctx.db.get(link.subcontractorId)];
                                    case 1:
                                        subcontractor = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, link), { subcontractor: subcontractor })];
                                }
                            });
                        }); }))];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results];
            }
        });
    }); },
});
// Create project-subcontractor link
export var create = mutation({
    args: {
        projectId: v.id("projects"),
        subcontractorId: v.id("subcontractors"),
        status: v.optional(complianceStatus),
        onSiteDate: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existing, linkId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_project_subcontractor", function (q) {
                        return q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId);
                    })
                        .first()];
                case 1:
                    existing = _a.sent();
                    if (existing) {
                        throw new Error("Subcontractor already assigned to this project");
                    }
                    return [4 /*yield*/, ctx.db.insert("projectSubcontractors", {
                            projectId: args.projectId,
                            subcontractorId: args.subcontractorId,
                            status: args.status || "pending",
                            onSiteDate: args.onSiteDate,
                            updatedAt: Date.now(),
                        })];
                case 2:
                    linkId = _a.sent();
                    return [2 /*return*/, linkId];
            }
        });
    }); },
});
// Update project-subcontractor link
export var update = mutation({
    args: {
        id: v.id("projectSubcontractors"),
        status: v.optional(complianceStatus),
        onSiteDate: v.optional(v.number()),
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
// Update compliance status
export var updateStatus = mutation({
    args: {
        id: v.id("projectSubcontractors"),
        status: complianceStatus,
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        status: args.status,
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Delete project-subcontractor link
export var remove = mutation({
    args: { id: v.id("projectSubcontractors") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.delete(args.id)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Remove subcontractor from project
export var removeByProjectAndSubcontractor = mutation({
    args: {
        projectId: v.id("projects"),
        subcontractorId: v.id("subcontractors"),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var link;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_project_subcontractor", function (q) {
                        return q.eq("projectId", args.projectId).eq("subcontractorId", args.subcontractorId);
                    })
                        .first()];
                case 1:
                    link = _a.sent();
                    if (!link) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.db.delete(link._id)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); },
});
// Get compliance stats for a project
export var getComplianceStats = query({
    args: { projectId: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var links, stats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projectSubcontractors")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .collect()];
                case 1:
                    links = _a.sent();
                    stats = {
                        total: links.length,
                        compliant: links.filter(function (l) { return l.status === "compliant"; }).length,
                        nonCompliant: links.filter(function (l) { return l.status === "non_compliant"; }).length,
                        pending: links.filter(function (l) { return l.status === "pending"; }).length,
                        exception: links.filter(function (l) { return l.status === "exception"; }).length,
                    };
                    stats.total > 0
                        ? stats.complianceRate = Math.round(((stats.compliant + stats.exception) / stats.total) * 100)
                        : stats.complianceRate = 0;
                    return [2 /*return*/, stats];
            }
        });
    }); },
});
// Get company-wide compliance stats
export var getCompanyComplianceStats = query({
    args: { companyId: v.id("companies") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var projects, totalCompliant, totalNonCompliant, totalPending, totalException, _loop_1, _i, projects_1, project, total;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("projects")
                        .withIndex("by_status", function (q) {
                        return q.eq("companyId", args.companyId).eq("status", "active");
                    })
                        .collect()];
                case 1:
                    projects = _a.sent();
                    totalCompliant = 0;
                    totalNonCompliant = 0;
                    totalPending = 0;
                    totalException = 0;
                    _loop_1 = function (project) {
                        var links;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, ctx.db
                                        .query("projectSubcontractors")
                                        .withIndex("by_project", function (q) { return q.eq("projectId", project._id); })
                                        .collect()];
                                case 1:
                                    links = _b.sent();
                                    totalCompliant += links.filter(function (l) { return l.status === "compliant"; }).length;
                                    totalNonCompliant += links.filter(function (l) { return l.status === "non_compliant"; }).length;
                                    totalPending += links.filter(function (l) { return l.status === "pending"; }).length;
                                    totalException += links.filter(function (l) { return l.status === "exception"; }).length;
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, projects_1 = projects;
                    _a.label = 2;
                case 2:
                    if (!(_i < projects_1.length)) return [3 /*break*/, 5];
                    project = projects_1[_i];
                    return [5 /*yield**/, _loop_1(project)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    total = totalCompliant + totalNonCompliant + totalPending + totalException;
                    return [2 /*return*/, {
                            total: total,
                            compliant: totalCompliant,
                            nonCompliant: totalNonCompliant,
                            pending: totalPending,
                            exception: totalException,
                            complianceRate: total > 0
                                ? Math.round(((totalCompliant + totalException) / total) * 100)
                                : 0,
                        }];
            }
        });
    }); },
});
