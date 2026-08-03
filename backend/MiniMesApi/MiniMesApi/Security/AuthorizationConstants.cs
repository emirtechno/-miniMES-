namespace MiniMesApi.Security;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Operator = "Operator";
    public const string Auditor = "Auditor";

    public static readonly string[] All = [Admin, Operator, Auditor];
}

public static class AppPermissions
{
    public const string ProductionWrite = "production.write";
    public const string ProductionManage = "production.manage";
    public const string ProductionHardDelete = "production.hard-delete";
    public const string MetricsRead = "metrics.read";
    public const string AlarmWrite = "alarms.write";
    public const string AlarmManage = "alarms.manage";
    public const string WorkOrderManage = "workorders.manage";
    public const string DeletedRecordsRead = "deleted-records.read";
    public const string UserManage = "users.manage";

    public static IReadOnlyCollection<string> ForRoles(IEnumerable<string> roles)
    {
        var permissions = new HashSet<string>(StringComparer.Ordinal);

        foreach (var role in roles)
        {
            if (role is AppRoles.Admin)
            {
                permissions.UnionWith(
                [
                    ProductionWrite,
                    ProductionManage,
                    ProductionHardDelete,
                    MetricsRead,
                    AlarmWrite,
                    AlarmManage,
                    WorkOrderManage,
                    DeletedRecordsRead,
                    UserManage
                ]);
            }
            else if (role is AppRoles.Operator)
            {
                permissions.UnionWith([ProductionWrite, AlarmWrite, MetricsRead]);
            }
            else if (role is AppRoles.Auditor)
            {
                permissions.UnionWith([DeletedRecordsRead, MetricsRead]);
            }
        }

        return permissions;
    }
}

public static class PolicyNames
{
    public const string ProductionWrite = nameof(ProductionWrite);
    public const string ProductionManage = nameof(ProductionManage);
    public const string ProductionHardDelete = nameof(ProductionHardDelete);
    public const string MetricsRead = nameof(MetricsRead);
    public const string AlarmWrite = nameof(AlarmWrite);
    public const string AlarmManage = nameof(AlarmManage);
    public const string WorkOrderManage = nameof(WorkOrderManage);
    public const string DeletedRecordsRead = nameof(DeletedRecordsRead);
    public const string UserManage = nameof(UserManage);
}
