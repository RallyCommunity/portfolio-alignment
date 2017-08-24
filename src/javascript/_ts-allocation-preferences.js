Ext.define('Rally.technicalservices.preferences.Allocation',{
    logger: new Rally.technicalservices.Logger(),
    noneText: 'None',
    allocationsByRelease: null,
    project: null,
    /**
     *  {
     *      releaseKey1:  {
     *          A:
     *          B:
     *          C:
     *          D:
     *      }
     *      releaseKey2: {}
     *  }
     *
     */
    constructor: function(config){
        this.allocationsByRelease = {};
        Ext.apply(this,config);

    },
    getAllocationHash: function(release){

        return this.allocationsByRelease[this.getReleaseKey(release)] || this.defaultHash;
    },
    getReleaseKey: function(release){
        if (release){
            var startDate = Rally.util.DateTime.fromIsoString(release.get('ReleaseStartDate')),
                endDate = Rally.util.DateTime.fromIsoString(release.get('ReleaseDate'));

            var utcStartDate = Rally.util.DateTime.toUtcIsoString(startDate),
                utcEndDate = Rally.util.DateTime.toUtcIsoString(endDate);

            var key =  utcStartDate + utcEndDate + release.get('Name');
            return key.substring(0,254);
        } else {
            return "Unscheduled";
        }

    },
    load: function(appId, portfolioItemType, targetValues){
        var deferred = Ext.create('Deft.Deferred');
        this.allocationsByRelease = {};
        this.defaultHash = this._buildDefaultHash(targetValues);
        Rally.data.PreferenceManager.load({
            appID: appId,
            project: this.project,
            filterByName: portfolioItemType,
            scope: this,
            success: function(prefs) {
                if (prefs[portfolioItemType]){
                    this.allocationsByRelease = Ext.JSON.decode(prefs[portfolioItemType]);

                    this.logger.log('load preferences project',this.project, this.allocationsByRelease);
                }
                deferred.resolve();
            }
        });
        return deferred;
    },
    update: function(appId, portfolioItemType, release, targetHash){

        this.allocationsByRelease[this.getReleaseKey(release)] = targetHash;

        var prefs = {};
        prefs[portfolioItemType] = Ext.JSON.encode(this.allocationsByRelease);

        Rally.data.PreferenceManager.update({
            appID: appId,
            settings: prefs,
            project: this.project,
            scope: this,
            success: function(updatedRecords, notUpdatedRecords) {
                this.logger.log('_setTargetAllocationHash save preferences',updatedRecords, notUpdatedRecords,
                    'appId',appId,'project',this.project, 'settings',prefs,'release',this.getReleaseKey(release));
            }
        });
    },
    _cleanseHash: function(hash){
        var cleansedHash = {},
            noneText = this.noneText;

        _.each(values, function(v){
            if (v && v.length > 0) {
                cleansedHash[v] = 0;
            }
        });
        cleansedHash[noneText] = 0;

        _.each(hash, function(value, key){
            if (Ext.Array.contains(values, key)){
                cleansedHash[key] = value;
            } else {
                cleansedHash[noneText] = (cleansedHash[noneText] || 0) + value;
            }
        });
        return cleansedHash;
    },
    _buildDefaultHash: function(targetValues){
        var targetAllocationHash = {},
            numValidTargetValues = _.without(targetValues,"").length,
            defaultTargetAllocation = numValidTargetValues > 0 ? 100 / numValidTargetValues : 100;
        this.logger.log('_buildDefaultHash', targetValues);
        Ext.each(targetValues, function(f){
            if (f && f.length > 0){
                targetAllocationHash[f] = defaultTargetAllocation;
            }
        });
        return targetAllocationHash;
    }
});
