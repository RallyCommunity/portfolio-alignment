Ext.define("PortfolioAlignment", {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype: 'container', itemId: 'settings_box'},
        {xtype: 'container', itemId: 'ct-header',cls: 'header', layout: {type: 'hbox'}},
        {xtype: 'container',itemId:'ct-display', layout:{type: 'hbox'}},
        {xtype: 'container',
            itemId:'ct-legend',
            layout: {type: 'hbox', pack: 'center'} ,
            padding: 10
        },
        {
            xtype: 'tsinfolink',
            height: 20,
            renderData: {date: Rally.util.DateTime.formatWithDefaultDateTime(new Date())}
        }],
    /**
     * TimeboxScopedApp settings
     */
    scopeType: 'release',
    comboboxConfig: {
        fieldLabel: 'Release',
        labelAlign: 'right',
        width: 300,
        margin: 10
    },
    cursor: 'pointer',
    /**
     * PortfolioAlignment app settings
     */
    portfolioItemFetchFields: ['Name','ObjectID','FormattedID','AcceptedLeafStoryPlanEstimateTotal','LeafStoryPlanEstimateTotal','PreliminaryEstimate','Value'],
    config: {
        defaultSettings: {
            persistAllocationsForProject:  false
        }
    },
    chartSettings: null,

    onNoAvailableTimeboxes: function(){
        this.logger.log('No available releases');
    },
    onScopeChange: function(scope){
        this.logger.log('scope changed',scope);
        this._updateApp();
    },
    _addComponents: function(){
        if (this.getHeader()) {
           // this.getHeader().layout = {type:'hbox'};
        } else {
            this.add({xtype: 'container',itemId:'ct-header', cls: 'header', layout: {type: 'hbox'}});
            this.add({xtype: 'container',itemId:'ct-display', layout:{type: 'hbox'}});
            this.add({xtype: 'container',itemId:'ct-legend', flex: 1, layout:{type: 'hbox', pack: 'center'}});
            this.add({xtype: 'tsinfolink', renderData: {date: Rally.util.DateTime.formatWithDefaultDateTime(new Date())}});
        }
        this.cbPortfolioItemType = this.getHeader().add({
            xtype: 'rallyportfolioitemtypecombobox',
            itemId: 'type-combo',
            fieldLabel: 'Portfolio Item Type',
            labelWidth: 100,
            labelAlign: 'right',
            margin: 10,
            storeConfig: {
                sorters: [{
                    property: 'Ordinal',
                    direction: 'ASC'
                }],
                filters: [{
                    property: 'Ordinal',
                    value: 0
                }]
            },
            listeners: {
                scope: this,
                ready: function(cb) {
                    var rec = cb.getStore().getAt(0);
                    cb.setValue(rec.get(cb.valueField));
                    //cb.setDisabled(true);  //Temporary until we figure out how to handle parent portfolio item type
                },
                change: this._updatePortfolioItemConfig
            },
            hidden: true //until we decide to deal with the upper level portfolio items.
        });

        this.getHeader().add({
            xtype: 'rallybutton',
            text: 'Configure Targets...',
            scope: this,
            handler: this._buildTargetDialog,
            margin: 10
        });

    },
    initComponent: function() {
        this.callParent([]);
     },
    launch: function(){
        this.callParent();
        if (this.isExternal()){
            this.showSettings(this.config);
        } else {
            this.onSettingsUpdate(this.getSettings());  //(this.config.type,this.config.pageSize,this.config.fetch,this.config.columns);
        }
   },
    getHeader: function() {
        return this.down('container[cls=header]');
    },
    _updatePortfolioItemConfig: function(cb){
        this.logger.log('_updatePortfolioItemConfig')
        var workspaceRef = this.getContext().getWorkspace()._ref;
        var targetField = this.chartSettings.categoryField;
        this.portfolioItemType = cb.getRecord().get('TypePath');
        this.portfolioItemDisplayName = cb.getRecord().get(cb.displayField);
        //Temporary
        if (cb.getRecord().get('Ordinal') > 0){
            return;  //Don't process becuase we can't handle this yet
        }

        this.logger.log('_loadCategories', this.portfolioItemType, targetField);

        Rally.data.wsapi.ModelFactory.getModel({
            type: this.portfolioItemType,
            context: {
                workspace: workspaceRef
            },
            scope: this,
            success: function(model) {
                var field = model.getField(targetField);
                field.getAllowedValueStore().load({
                    fetch: ['StringValue'],
                    callback: function(allowedValues, operation, success){
                        if (success){
                            var values = _.map(allowedValues, function(av){return av.get('StringValue')});
                            var i = 0;

                            var legendColors = {};
                            values.push(this.chartSettings.noneText);
                            this.logger.log('AllowedValues ', values);
                            Ext.each(values, function(v){
                                if (v && v.length > 0) {
                                    legendColors[v] = this.chartSettings.chartColors[i++];
                                }
                                if (i == this.chartSettings.chartColors.length){
                                    i = 0;
                                }
                            }, this);
                            this.chartSettings.setLegendColors(legendColors);
                            this.targetFieldValues = values;

                            var projectRef = this.chartSettings.persistAllocationsByProject ?
                                this.getContext().getProjectRef() : null;

                            this.logger.log('project persistence settings', this.chartSettings.persistAllocationsByProject,
                                projectRef, this.getContext().getProjectRef());

                            this.allocationPreferences = Ext.create('Rally.technicalservices.preferences.Allocation',{
                                noneText: this.noneText,
                                project: projectRef
                            });
                           this.allocationPreferences.load(this.getAppId(),this.portfolioItemType,values).then({
                                scope: this,
                                success: function(){
                                    this._updateApp();
                                }
                            });
                        } else {
                            var msg = 'Error retrieving allowed values for ' + targetField + ': ' + operation.error.errors[0];
                            Rally.ui.notify.Notifier.showError({message: msg});
                        }
                    },
                    scope: this
                });
            }
        });
    },
    _updateChart: function(chartItemId, series, config){
        var queryId = '#' + chartItemId,
            ct = this.down(queryId);

        if (ct){
            this.down(queryId).removeAll();
        } else {
            ct = this.down('#ct-display').add({
                xtype: 'container',
                itemId: chartItemId,
                flex: 1,
                maxHeight: 350
            });
        }

        var chart = ct.add ({
            xtype: 'rallychart',
            loadMask: false,
            chartData: {
                series: series
            },
            chartConfig: config
        });

        ct.setHeight(350);
    },
    _addLegend: function(){

        this.down('#ct-legend').removeAll();

        var color_data = [];
        _.each(this.chartSettings.legendColors, function(color, label){
            color_data.push({color: color, label: label});
        });

        var ct = this.down('#ct-legend').add({
            xtype: 'container',
            //height: 40,
            tpl: '<tpl for="."><div class="tslegend" style="background-color:{color}">&nbsp;&nbsp;</div><div class="tslegendtext">&nbsp;&nbsp;{label}</div><span class="tslegendspacer">&nbsp;</span></tpl>'
        });
        ct.update(color_data);

    },
    _updateTargetChart: function(){
        this._updateChart('ct-target',[this._getTargetChartData()],this._getChartConfig("targeted"));
    },
    _updateApp: function() {
        var piTypeRecord = this.portfolioItemType,
            timebox = null,
            allowedValues = this._getTargetFieldValues();

        if (this.getContext().getTimeboxScope()){
            timebox = this.getContext().getTimeboxScope().getRecord();
        }

        this.logger.log('_updateApp PortfolioItem Type, Timebox, categories', piTypeRecord, timebox, allowedValues);

        if (piTypeRecord && allowedValues) {
            this.down('#ct-display').removeAll();  //cleanup


            this._fetchData(piTypeRecord, timebox).then({
                scope: this,
                success: function(data){
                    this.logger.log('_fetchData', data);

                     if (data && data.length > 0){
                         this._updateTargetChart();

                         this._addLegend();

                         this._updateChart('ct-planned',
                            [this._getChartData(data,"planned")],
                            this._getChartConfig("planned"));

                        this._updateChart('ct-scheduled',
                            [this._getChartData(data,"scheduled")],
                            this._getChartConfig("scheduled"));

                        this._updateChart('ct-actual',
                            [this._getChartData(data,"actual")],
                            this._getChartConfig("actual"));

                     } else {
                         var releaseName = timebox ? timebox.get('Name') : '(No Release)';
                        this.down('#ct-display').add({
                            xtype: 'container',
                            html: Ext.String.format('No {0} data was found for the currently selected project ({1}) in {2}',piTypeRecord, this.getContext().getProject().Name, releaseName),
                            style: {
                                textAlign: 'center',
                                fontSize: '12px'
                            },
                             flex: 1
                        });
                        Rally.ui.notify.Notifier.showWarning({message: 'No ' + piTypeRecord + ' data was found for the currently selected project scope (' + this.getContext().getProject().Name + ') and release.'});
                    }
                },
                failure: function(operation){
                    var msg = 'Error fetching portfolio items:  ' + operation.error.errors[0];
                    Rally.ui.notify.Notifier.showError({message: msg});
                    this.down('#ct-display').add({
                        xtype: 'container',
                        html: msg,
                        style: {
                            textAlign: 'center',
                            fontSize: '12px',
                            color: 'red'
                        },
                        flex: 1
                    });
                }
            });

        }
        return;
    },
     _initCategoryDataHash: function(){
        var category_data = {},
            allowedValues = this._getTargetFieldValues();

        Ext.each(allowedValues, function(a){
            if (a && a.length > 0){
                category_data[a] = 0;
            }
        });
        category_data[this.chartSettings.noneText] = 0;
       // category_data[this.chartSettings.otherText] = 0;
        return category_data;
    },
    _getChartData: function(data, chartType){
        var category_data = this._initCategoryDataHash(),
            allowedValues = this._getTargetFieldValues(),
            targetField = this.chartSettings.categoryField,
            noneText = this.chartSettings.noneText,
            dataField = this.chartSettings.getChartTypeDataField(chartType),
            dataFieldAttribute = this.chartSettings.getChartTypeDataFieldAttribute(chartType);


        this.logger.log('_getChartData',dataField,dataFieldAttribute);
        Ext.each(data, function(rec){
            var categoryVal = rec.get(targetField) || noneText,
                dataVal = rec.get(dataField) || 0;

            if (dataVal && dataFieldAttribute){
                dataVal = dataVal[dataFieldAttribute] || 0;
            }

            if (dataVal > 0){
                if (_.has(category_data, categoryVal)){
                    category_data[categoryVal] += dataVal;
                } else {
                    //category_data[otherText] += dataVal;
                    this.logger.log('Category not valid', categoryVal, dataVal);
                }
            }
        }, this);


        var series_data = _.map(category_data, function(value, category){

                return {name: category, y: value, color: this.chartSettings.getLegendColor(category), visible: (value > 0)};
        },this);

        this.logger.log('_getChartData', this.chartSettings.getSeriesName(chartType), category_data, series_data);
        return {
                type: 'pie',
                name: this.chartSettings.getSeriesName(chartType),
                data:  series_data,
                showInLegend: false
        };

    },
    _fetchData: function(portfolioItemType, release){
        var deferred = Ext.create('Deft.Deferred'),
            fetch = this.portfolioItemFetchFields,
            context = {workspace: this.getContext().getWorkspace()._ref,
                        project: this.getContext().getProjectRef(),
                        projectScopeUp: this.getContext().getProjectScopeUp(),
                        projectScopeDown: this.getContext().getProjectScopeDown()
            };

        var filters = [{property: "Release", value: null}];
        if (release){
            filters = [{
                property: 'Release.Name',
                value: release.get('Name')
            },{
                property: 'Release.ReleaseStartDate',
                value: release.get('ReleaseStartDate')
            },{
                property: 'Release.ReleaseDate',
                value: release.get('ReleaseDate')
            }];
        }

        fetch.push(this.chartSettings.categoryField);
        this.logger.log('_fetchData',fetch, context);
        var store = Ext.create('Rally.data.wsapi.Store',{
            model: portfolioItemType,
            fetch: fetch,
            context: context,
            filters: filters,
            limit: 'Infinity',
            pageSize: 2000
        });
        store.load({
            callback: function(records, operation, success){
                this.logger.log('Portfolio item data load ',success, records,operation);
                if (success){
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation);
                }
            },
            scope: this
        });
        return deferred;
    },
    _getTargetChartData: function(){
        var categories = this._getTargetFieldValues();
        var series_data = [];
        if (!Ext.Array.contains(categories, this.chartSettings.noneText)){
            categories.push(this.chartSettings.noneText);
        }

        var release = this.getContext().getTimeboxScope().getRecord(),
            targetHash = this.allocationPreferences.getAllocationHash(release);
        Ext.each(categories, function(c){
            if (c && c.length > 0){
                var val = targetHash[c] || 0;
                series_data.push({name: c, y: val, color: this.chartSettings.getLegendColor(c)});
            };
        }, this);

        return {
                type: 'pie',
                name: this.chartSettings.getChartTitle("targeted"),
                data: series_data
            };
    },
    _getChartConfig: function(chartType){
            var title = this.chartSettings.getChartTitle(chartType),
                toolTip = this.chartSettings.getToolTip(chartType, this.portfolioItemDisplayName),
                noDataMessage = this.chartSettings.getNoDataMessage(chartType);

        return {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false,
                marginBottom: 0,
                marginTop: 0,
                spacingBottom: 0,
                events: {
                    load: function(){
                        var chart = this;
                        chart.title.on('mouseover', function(e){
                            Ext.create('Rally.ui.tooltip.ToolTip', {
                                target : e.target,
                                html: toolTip,
                                autoShow: true
                            });
                        });

                        var sum_vals = 0;
                        if (chart.series && chart.series[0] && chart.series[0].data){
                            sum_vals = Ext.Array.sum(_.map(chart.series[0].data, function(obj){return obj.y;}));
                        }

                        if (sum_vals <= 0){
                            var x = chart.plotWidth * .33,
                                y = chart.plotHeight * .40;
                            var noDataText = chart.renderer.text(noDataMessage,x,y).add();
                        }
                    }
                }
            },
            title: {
                text: title
            },
            tooltip: {
                pointFormat: '{point.y:.1f} (<b>{point.percentage:.1f}%</b>)'
            },
            plotOptions: {
                pie: {
                    size: '75%',
                    center: ['50%','50%'],
                    allowPointSelect: true,
                        dataLabels: {
                            enabled: this.chartSettings.showDataLabels,
                            distance: this.chartSettings.dataLabelDistance,
                            color: this.chartSettings.dataLabelColor,
                            crop: false,
                            overflow: 'none',
                            formatter: function(){
                                if (this.percentage > 0){
                                    return this.percentage.toFixed(1) + '%';
                                }
                                return null;
                            }
                    },
                    showInLegend: false
                }
            }
        };
    },
    _getTargetFieldValues: function(){
        if (this.targetFieldValues && this.targetFieldValues.length > 0){
            return this.targetFieldValues;
        }
        return null;
    },
    _buildTargetDialog: function(){
        var release = this.getContext().getTimeboxScope().getRecord(),
            appId = this.getAppId();
        this.logger.log('_buildTargetDialog', release);

        var releaseName = 'Unscheduled';
        if (release){
            releaseName = release.get('Name');
        }
        console.log('releaseName', releaseName, 'persistAllocationsByProject', this.chartSettings.persistAllocationsByProject);

        Ext.create('Rally.technicalservices.dialog.TargetAllocation', {
            releaseName: releaseName,
            persistAllocationsByProject: this.chartSettings.persistAllocationsByProject,
            targetAllocation: this.allocationPreferences.getAllocationHash(release),
            listeners: {
                scope: this,
                allocationsupdate: function(updatedHash){
                    this.logger.log('allocations updated', updatedHash);
                    this.allocationPreferences.update(appId,this.portfolioItemType,release,updatedHash);
                    this._updateTargetChart();
                }
            }
         });
    },
    /********************************************
     /* Overrides for App class
     /*
     /********************************************/
    //getSettingsFields:  Override for App
    getSettingsFields: function() {

        return [{
            name: 'persistAllocationsForProject',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Persist Allocations for Project',
            labelAlign: 'right',
            labelWidth: 200,
            readyEvent: 'afterrender'
        }];
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    //showSettings:  Override
    showSettings: function(options) {
        this._appSettings = Ext.create('Rally.app.AppSettings', Ext.apply({
            settings: this.getSettings(),
            defaultSettings: this.getDefaultSettings(),
            context: this.getContext(),
            settingsScope: this.settingsScope,
            autoScroll: true,
            fields: this.getSettingsFields()
        }, options));

      //  this._appSettings.addSettingsFields(this.getSettingsFields());

        this._appSettings.on('cancel', this._hideSettings, this);
        this._appSettings.on('save', this._onSettingsSaved, this);
        if (this.isExternal()){
            if (this.down('#settings_box').getComponent(this._appSettings.id)==undefined){
                this.down('#settings_box').add(this._appSettings);
            }
        } else {
            this.hide();
            this.up().add(this._appSettings);
        }
        return this._appSettings;
    },
    _onSettingsSaved: function(settings){
        Ext.apply(this.settings, settings);
        this._hideSettings();
        this.onSettingsUpdate(settings);
    },
    onSettingsUpdate: function (settings){
        this.chartSettings = Ext.create('Rally.technicalservices.PortfolioAlignmentSettings',{
            persistAllocationsByProject: this.getSetting('persistAllocationsForProject')
        });
        this._addComponents();
    }
});
