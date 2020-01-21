import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MonitoringObject } from '../../class/monitoring-object';
import { Utils } from '../../utils/utils';
import { Router } from '@angular/router';
import { ConfigService } from '../../services/config.service';

import { mergeMap } from '@librairies/rxjs/operators';


@Component({
  selector: 'pnx-monitoring-form',
  templateUrl: './monitoring-form.component.html',
  styleUrls: ['./monitoring-form.component.css']
})
export class MonitoringFormComponent implements OnInit {

  @Input() currentUser;

  @Input() objForm: FormGroup;

  @Input() obj: MonitoringObject;
  @Input() objChanged = new EventEmitter<MonitoringObject>();

  @Input() objectsStatus;
  @Output() objectsStatusChange = new EventEmitter<Object>();

  @Input() bEdit: boolean;
  @Output() bEditChange = new EventEmitter<boolean>();

  objSchema;

  public bSaveSpinner = false;
  public bSaveAddSpinner = false;
  public bDeleteSpinner = false;
  public bDeleteModal = false;
  public bChainInput = false;

  constructor(
    private _formBuilder: FormBuilder,
    private _router: Router,
    private _configService: ConfigService,
  ) { }

  ngOnInit() {
    this._configService.init(this.obj.modulePath)
      .pipe(
        mergeMap(() => {
          this.bChainInput = this._configService.frontendParams()['bChainInput'];
          this.objSchema = this.obj.schema();
          return this.obj.formValues();
        })
      )
      .subscribe((formValues) => {
        // set geometry
        if (this.obj.config['geometry_type']) {
          this.objForm.addControl('geometry', this._formBuilder.control('', Validators.required));
        }
        this.setFormValue(formValues);
      });
  }

  isFormReady() {
    let schemaFormSize = this.objSchema
      .filter(elem => elem.type_widget)
      .length;
    if (this.obj.config['geometry_type']) {
      schemaFormSize += 1;
    }
    const formSize = Utils.dictSize(this.objForm.controls);
    return schemaFormSize === formSize;
  }

  setFormValue(formValue) {
    const objFormChangeSubscription = this.objForm.valueChanges
      .subscribe(() => {
        if (this.isFormReady()) {
          objFormChangeSubscription.unsubscribe();
          this.objForm.setValue(formValue);
          this.setDefaultFormValue();
        }
      });
    // emit change programmatically
    this.objForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  resetObjForm() {
    this.obj = new MonitoringObject(this.obj.modulePath, this.obj.objectType, null, this.obj.monitoringObjectService());
    this.obj.properties[this.obj.configParam('id_field_Name')] = null;
    this.obj.get(0).
      pipe(
        mergeMap(() => {
          this.obj.bIsInitialized = true;
          return this.obj.formValues();
        })
      ).subscribe((formValue) => {
        this.setFormValue(formValue);
        this.objChanged.emit(this.obj);
      });
  }

  setDefaultFormValue() {
    const values = this.objForm.value;
    const defaultValues = {};

    defaultValues['id_digitiser'] = values['id_digitiser'] || this.currentUser.id_role;
    this.objForm.patchValue(defaultValues);
  }

  navigateToParent() {
    if (this.obj.objectType.includes('module')) {
      this._router.navigate(['/', this._configService.frontendModuleMonitoringUrl()]);
    }
    if (this.obj.parentType().includes('module')) {
      this._router.navigate(['/', this._configService.frontendModuleMonitoringUrl(), 'module', this.obj.modulePath]);
      return;
    } else {
      this._router.navigate([
          '/',
          this._configService.frontendModuleMonitoringUrl(),
          'object', this.obj.modulePath,
          this.obj.parentType(),
          this.obj.parentId
        ]);
      return;
    }
  }

  reload_create_route() {
    this._router.navigate(['/']);
    setTimeout(() => {
      this._router.navigate([
        '/',
        this._configService.frontendModuleMonitoringUrl(),
        'create_object',
        this.obj.modulePath,
        this.obj.objectType,
        this.obj.parentId]);
    }, 100);
  }

  onSubmit(addNew = false) {
    this.bSaveSpinner = !addNew;
    this.bSaveAddSpinner = addNew;

    const action = this.obj.id ? this.obj.patch(this.objForm.value) : this.obj.post(this.objForm.value);
    const actionLabel = this.obj.id ? 'Modification' : 'Création';
    action.subscribe((objData) => {

      console.log('info', `${actionLabel} de ${this.obj.configParam('label')} ${this.obj.id} effectué`);
      this.bSaveSpinner = this.bSaveAddSpinner = false;
      // this.objChange.emit(this.obj);
      if (this.obj.objectType.includes('module')) {
        this._router.navigate(['/', this._configService.frontendModuleMonitoringUrl(), 'module', this.obj.modulePath]);
      } else {
        if (addNew) {
          this.resetObjForm();
        } else {
          this.navigateToParent();
        }
      }
    });
  }

  onCancelEdit() {
    if (this.obj.id) {
      this.bEditChange.emit(false);
    } else {
      this.navigateToParent();
    }
  }

  onDelete() {
    this.bDeleteSpinner = true;
    const msg_delete = `${this.obj.template['label']} ${this.obj.id} supprimé. parent ${this.obj.parentType()} ${this.obj.parentId}`;

    this.obj
      .delete()
      .subscribe((objData) => {
        this.bDeleteSpinner = this.bDeleteModal = false;
        this.navigateToParent();
      });
  }

  bChainInputChanged() {
    this._configService.setFrontendParams('bChainInput', this.bChainInput);
  }
}
