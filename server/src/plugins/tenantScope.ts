import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Tenant scope plugin — attaches to every tenant-owned model.
 *
 * Security guarantee: if a query on a tenant-scoped model does NOT include
 * a `brokerageId` filter, the plugin throws before the query reaches MongoDB.
 * This means a developer forgetting to scope a query is caught at runtime,
 * not silently leaking data.
 *
 * Usage: schema.plugin(tenantScopePlugin)
 * Skipping enforcement (e.g. platform-admin aggregate): query.setOptions({ skipTenantCheck: true })
 */
export function tenantScopePlugin(schema: Schema): void {
  // List of Mongoose query methods that must be scoped
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'countDocuments',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
  ] as const;

  for (const method of queryMethods) {
    schema.pre(method, function (this: mongoose.Query<unknown, Document>, next) {
      // Allow platform-admin bypass when explicitly opted in
      const opts = this.getOptions() as Record<string, unknown>;
      if (opts['skipTenantCheck'] === true) return next();

      const filter = this.getFilter() as Record<string, unknown>;

      // Enforce brokerageId presence in the filter
      if (!filter['brokerageId']) {
        const err = new Error(
          `[tenantScope] Query on "${this.model.modelName}" is missing brokerageId filter. ` +
            `This is a security violation. Add { brokerageId } to the query or ` +
            `set { skipTenantCheck: true } for intentional platform-admin queries.`,
        );
        return next(err);
      }

      next();
    });
  }
}
