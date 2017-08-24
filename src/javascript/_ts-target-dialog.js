Ext.define('Rally.technicalservices.dialog.TargetAllocation', {
    extend: 'Rally.ui.dialog.Dialog',
    autoShow: true,
    draggable: true,
    modal: true,
    width: 350,
    title: 'Target Allocations',
    items: {
        xtype: 'container',
        itemId: 'dialog-body',
        padding: 10
    },
    dockedItems: [
        {
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '10',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    cls: 'primary',
                    itemId: 'saveButton',
                    text: 'Save',
                    disabled: true
                },
                {
                    xtype: 'rallybutton',
                    cls: 'cancel secondary',
                    text: 'Cancel',
                    itemId: 'cancelButton'
                }
            ]
        }
    ],
    initComponent: function(){
        this.callParent(arguments);

        this.addEvents('allocationsupdate');
        var ignore_regex = new RegExp("^__changed");
        _.each(this.targetAllocation, function(val,key){
            if (!ignore_regex.test(key)){
                this.down('#dialog-body').add({
                    xtype: 'rallynumberfield',
                    fieldLabel: key,
                    labelAlign: 'right',
                    labelWidth: 150,
                    value: val || 0,
                    minValue: 0,
                    maxValue: 100,
                    listeners: {
                        scope: this,
                        change: this._validate
                    }
                });
            }
        }, this);

        var html = 'Settings change log not available.';
        if (this.targetAllocation['__changedBy'] && this.targetAllocation['__changedBy'].length > 0 &&
            this.targetAllocation['__changedOn'] && this.targetAllocation['__changedOn'].length > 0){
            html = Ext.String.format('<br/><br/>Preferences for {2} changed by {0} on {1}', this.targetAllocation['__changedBy'], this.targetAllocation['__changedOn'] || '<None>', this.releaseName);
        }

        this.title = 'Target Allocations for Workspace'
        if (this.persistAllocationsByProject === true || this.persistAllocationsByProject == "true"){
            this.title = 'Target Allocations for Project';
        }
        this.down('#dialog-body').add({
            xtype: 'container',
            html: html,
            style: {
                color: '#c0c0c0'
            }
        });
        this._validate();
        this.down('#saveButton').on('click', this._onSave, this);
        this.down('#cancelButton').on('click', this._onCancel, this);
    },
    _getUpdatedAllocations: function(){
        var allocations = {};
        var cmps = this.down('#dialog-body').query('rallynumberfield');
        _.each(cmps, function(cmp){
            allocations[cmp.fieldLabel] = cmp.getValue();
        });
        allocations.__changedBy = Rally.getApp().getContext().getUser().UserName;
        allocations.__changedOn = new Date();
        return allocations;
    },
    _validate: function(){

        var cmps = this.down('#dialog-body').query('rallynumberfield');
        var val = 0;
        _.each(cmps, function(cmp){
            val += cmp.getValue();
        });
        var valid = (val === 100);

        this.down('#saveButton').setDisabled(!valid);
        return valid;
    },
    _onSave: function(){
        var targetAllocationHash = this._getUpdatedAllocations();
        this.fireEvent('allocationsupdate', targetAllocationHash);
        this.destroy();
    },
    _onCancel: function(){
        this.destroy();
    }
});
