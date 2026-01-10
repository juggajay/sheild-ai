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
// Verification status type validator
var verificationStatus = v.union(v.literal("pass"), v.literal("fail"), v.literal("review"));
// Get verification by ID
export var getById = query({
    args: { id: v.id("verifications") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get verification by ID with related data
export var getByIdWithDetails = query({
    args: { id: v.id("verifications") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var verification, _a, document, project, verifiedByUser, subcontractor;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ctx.db.get(args.id)];
                case 1:
                    verification = _b.sent();
                    if (!verification)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, Promise.all([
                            ctx.db.get(verification.cocDocumentId),
                            ctx.db.get(verification.projectId),
                            verification.verifiedByUserId
                                ? ctx.db.get(verification.verifiedByUserId)
                                : null,
                        ])
                        // Get subcontractor from document
                    ];
                case 2:
                    _a = _b.sent(), document = _a[0], project = _a[1], verifiedByUser = _a[2];
                    subcontractor = null;
                    if (!document) return [3 /*break*/, 4];
                    return [4 /*yield*/, ctx.db.get(document.subcontractorId)];
                case 3:
                    subcontractor = _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/, __assign(__assign({}, verification), { document: document, project: project, subcontractor: subcontractor, verifiedByUser: verifiedByUser
                            ? __assign(__assign({}, verifiedByUser), { passwordHash: undefined }) : null })];
            }
        });
    }); },
});
// Get verification by document
export var getByDocument = query({
    args: { cocDocumentId: v.id("cocDocuments") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_document", function (q) { return q.eq("cocDocumentId", args.cocDocumentId); })
                        .first()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get verifications by project
export var getByProject = query({
    args: { projectId: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .order("desc")
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Get verifications by project and status
export var getByProjectAndStatus = query({
    args: {
        projectId: v.id("projects"),
        status: verificationStatus,
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_status", function (q) {
                        return q.eq("projectId", args.projectId).eq("status", args.status);
                    })
                        .collect()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
});
// Create verification
export var create = mutation({
    args: {
        cocDocumentId: v.id("cocDocuments"),
        projectId: v.id("projects"),
        status: verificationStatus,
        confidenceScore: v.optional(v.number()),
        extractedData: v.optional(v.any()),
        checks: v.optional(v.array(v.any())),
        deficiencies: v.optional(v.array(v.any())),
        verifiedByUserId: v.optional(v.id("users")),
        verifiedAt: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var existing, verificationId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_document", function (q) { return q.eq("cocDocumentId", args.cocDocumentId); })
                        .first()];
                case 1:
                    existing = _a.sent();
                    if (existing) {
                        throw new Error("Verification already exists for this document");
                    }
                    return [4 /*yield*/, ctx.db.insert("verifications", {
                            cocDocumentId: args.cocDocumentId,
                            projectId: args.projectId,
                            status: args.status,
                            confidenceScore: args.confidenceScore,
                            extractedData: args.extractedData || {},
                            checks: args.checks || [],
                            deficiencies: args.deficiencies || [],
                            verifiedByUserId: args.verifiedByUserId,
                            verifiedAt: args.verifiedAt,
                            updatedAt: Date.now(),
                        })
                        // Update document processing status
                    ];
                case 2:
                    verificationId = _a.sent();
                    // Update document processing status
                    return [4 /*yield*/, ctx.db.patch(args.cocDocumentId, {
                            processingStatus: "completed",
                            processedAt: Date.now(),
                            updatedAt: Date.now(),
                        })];
                case 3:
                    // Update document processing status
                    _a.sent();
                    return [2 /*return*/, verificationId];
            }
        });
    }); },
});
// Update verification
export var update = mutation({
    args: {
        id: v.id("verifications"),
        status: v.optional(verificationStatus),
        confidenceScore: v.optional(v.number()),
        extractedData: v.optional(v.any()),
        checks: v.optional(v.array(v.any())),
        deficiencies: v.optional(v.array(v.any())),
        verifiedByUserId: v.optional(v.id("users")),
        verifiedAt: v.optional(v.number()),
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
// Manual verification by user
export var manualVerify = mutation({
    args: {
        id: v.id("verifications"),
        status: verificationStatus,
        verifiedByUserId: v.id("users"),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db.patch(args.id, {
                        status: args.status,
                        verifiedByUserId: args.verifiedByUserId,
                        verifiedAt: Date.now(),
                        updatedAt: Date.now(),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
});
// Delete verification
export var remove = mutation({
    args: { id: v.id("verifications") },
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
// Get verification stats for a project
export var getProjectStats = query({
    args: { projectId: v.id("projects") },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var verifications;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .collect()];
                case 1:
                    verifications = _a.sent();
                    return [2 /*return*/, {
                            total: verifications.length,
                            pass: verifications.filter(function (v) { return v.status === "pass"; }).length,
                            fail: verifications.filter(function (v) { return v.status === "fail"; }).length,
                            review: verifications.filter(function (v) { return v.status === "review"; }).length,
                            averageConfidence: verifications.length > 0
                                ? Math.round(verifications.reduce(function (acc, v) { return acc + (v.confidenceScore || 0); }, 0) /
                                    verifications.length)
                                : 0,
                        }];
            }
        });
    }); },
});
// Get recent verifications for dashboard
export var getRecent = query({
    args: {
        projectId: v.id("projects"),
        limit: v.optional(v.number()),
    },
    handler: function (ctx, args) { return __awaiter(void 0, void 0, void 0, function () {
        var verifications, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ctx.db
                        .query("verifications")
                        .withIndex("by_project", function (q) { return q.eq("projectId", args.projectId); })
                        .order("desc")
                        .take(args.limit || 10)
                    // Get document and subcontractor details
                ];
                case 1:
                    verifications = _a.sent();
                    return [4 /*yield*/, Promise.all(verifications.map(function (v) { return __awaiter(void 0, void 0, void 0, function () {
                            var doc, subcontractor, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, ctx.db.get(v.cocDocumentId)];
                                    case 1:
                                        doc = _b.sent();
                                        if (!doc) return [3 /*break*/, 3];
                                        return [4 /*yield*/, ctx.db.get(doc.subcontractorId)];
                                    case 2:
                                        _a = _b.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _a = null;
                                        _b.label = 4;
                                    case 4:
                                        subcontractor = _a;
                                        return [2 /*return*/, __assign(__assign({}, v), { document: doc, subcontractor: subcontractor })];
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
