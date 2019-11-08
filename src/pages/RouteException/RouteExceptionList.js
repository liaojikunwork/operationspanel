import React, { Component } from "react";
import { Container, Row, Col, Table, Button } from "reactstrap";
import { Link } from "react-router-dom";
import SweetAlert from "sweetalert2-react";
import T from "i18n-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import getValue from "get-value";
import { ROUTE_EXCEPTION_TYPE } from "common/constants/models/route-exception-type";
import { ROUTE_BUNDLE } from "common/constants/models/route-bundle";
import { ROLE } from "common/constants/models/role";
import { hasRoles } from "../../components/Auth/AuthProvider";
import { Pagination } from "../../components/Pagination/Pagination";
import API from "../../components/API/API";
import Dropdown from "../../components/Dropdown/Dropdown";
import SearchBy from "../../components/Search/SearchBy";
import InitialsAvatar from "../../components/InitialsAvatar/InitialsAvatar";
import { withHeader } from "../../components/HeaderProvider/HeaderProvider";

class RouteExceptionList extends Component {
  constructor(props) {
    super(props);

    this.API = new API();

    this.pagination = React.createRef();

    this.typeOptions = ["All"].concat(
      Object.keys(ROUTE_EXCEPTION_TYPE).map(
        type => ROUTE_EXCEPTION_TYPE[type].name
      )
    );

    this.statusOptions = ["All", "Active", "Inactive"];

    this.bundleTypes = Object.keys(ROUTE_BUNDLE)
      .map(type => ROUTE_BUNDLE[type])
      .reduce((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {});

    this.sortFields = [
      { name: "routeId", field: "routeId" },
      { name: "shipmentId", field: "shipmentId" },
      { name: "type", field: "typeId" },
      { name: "active", field: "active" },
      { name: "createdAt", field: "createdAt" }
    ];

    this.searchFields = [
      { name: "Route", field: "routeId", type: "text" },
      { name: "Tracking Id", field: "shipmentId", type: "text" },
      { name: "Creation Date", field: "createdAt", type: "date" }
    ];

    this.getIcon = name => {
      const { sortBy } = this.state;

      const element = this.sortFields.find(d => d.name === name);
      if (!element) {
        return "";
      }

      const { field } = this.sortFields.find(d => d.name === name);
      const icon = field === sortBy.field ? sortBy.icon : "sort";
      return <FontAwesomeIcon className="sort-icon" icon={icon} />;
    };

    this.state = {
      resourceNameOnApi: "routeExceptions",
      listItems: [],
      sortBy: {
        field: "",
        type: "",
        icon: ""
      },
      order: "createdAt ASC",
      backupList: [],
      searchKeyword: "",
      selectedFilter: this.searchFields[0],
      statusOption: this.statusOptions[0],
      typeOption: this.typeOptions[0],
      searchParam: {
        filter: {
          include: ["route", "shipment", "type"]
        }
      }
    };

    this.delete = id => {
      const { resourceNameOnApi } = this.state;
      this.API.delete(`/${resourceNameOnApi}/${id}`).then(() => {
        this.pagination.current.fetchItems();
      });
    };

    this.getFilterId = (model, value) => {
      const key = Object.keys(model).filter(
        item => model[item].name === value
      )[0];
      return model[key].id;
    };

    this.handleFilterChange = (key, value) => {
      this.setState({ [key]: value }, () => {
        const { searchKeyword, selectedFilter } = this.state;
        this.handleSearch(searchKeyword, selectedFilter);
      });
    };

    this.handleSortChange = name => {
      const element = this.sortFields.find(d => d.name === name);
      if (!element) {
        return;
      }

      const { sortBy } = this.state;
      const { type, field: previousField } = sortBy;
      const { field } = element;

      let newType = "DESC";

      if (field === previousField) {
        newType = type === "ASC" ? "DESC" : "ASC";
      }

      this.setState(
        {
          sortBy: {
            field,
            type: newType,
            icon: newType === "ASC" ? "sort-up" : "sort-down"
          },
          order: `${field} ${newType}`
        },
        () => {
          this.pagination.current.fetchItemCount();
        }
      );
    };

    this.handleSearch = async (data, filter) => {
      const { statusOption, typeOption } = this.state;
      let params;
      if (data) {
        const { field } = filter;
        switch (field) {
          case "createdAt": {
            params = {
              filter: {
                where: {
                  [field]: {
                    between: [data.fromDate, data.toDate]
                  }
                }
              }
            };
            break;
          }
          case "shipmentId": {
            const response = await this.API.get("/shipments", {
              params: {
                filter: {
                  fields: ["id"],
                  where: { trackingId: { ilike: `%${data}%` } }
                }
              }
            });
            const ids = response.data.map(item => item.id);
            params = {
              filter: {
                where: {
                  [field]: {
                    inq: ids
                  }
                }
              }
            };
            break;
          }
          default: {
            params = {
              filter: {
                where: {
                  [field]: {
                    ilike: `%${data}%`
                  }
                }
              }
            };
            break;
          }
        }
        params.filter.include = ["route", "shipment", "type"];
      } else {
        params = {
          filter: {
            where: {},
            include: ["route", "shipment", "type"]
          }
        };
      }

      if (statusOption !== this.statusOptions[0]) {
        params.filter.where.active = statusOption === this.statusOptions[1];
      }

      if (typeOption !== this.typeOptions[0]) {
        const typeId = this.getFilterId(ROUTE_EXCEPTION_TYPE, typeOption);
        params.filter.where.typeId = typeId;
      }

      this.setState(
        {
          searchKeyword: data,
          searchParam: params
        },
        () => {
          this.pagination.current.fetchItemCount();
        }
      );
    };
  }

  componentDidMount() {
    const { resourceNameOnApi } = this.state;
    const { header } = this.props;
    header.setTitle(
      T.translate("routeExceptions.list.title"),
      T.translate("routeExceptions.list.description")
    );
    header.setActions([
      <Link
        to={{
          pathname: `/${resourceNameOnApi}/create`,
          state: {
            modal: true,
            modalTitle: T.translate("routeExceptions.form.title.create")
          }
        }}
        className="btn btn btn-secondary btn-rounded px-3"
      >
        <FontAwesomeIcon icon="plus" />{" "}
        {T.translate("routeExceptions.list.add")}
      </Link>
    ]);

    this.refreshTimer = setInterval(() => {
      this.pagination.current.fetchItemCount();
    }, 15000);
  }

  componentWillUnmount() {
    clearInterval(this.refreshTimer);
  }

  render() {
    const {
      resourceNameOnApi,
      listItems,
      showDeletionConfirmation,
      selectedItemToBeDeleted,
      order,
      searchParam
    } = this.state;

    return [
      <Container key="shipment-list-container" className="pt-3">
        <div className="box">
          <Container className="py-3">
            <Row className="justify-content-center">
              <Col md={3} sm={6}>
                <Dropdown
                  title={T.translate("routeExceptions.list.filters.type")}
                  list={this.typeOptions}
                  handleChange={value =>
                    this.handleFilterChange("typeOption", value)
                  }
                />
              </Col>
              <Col md={3} sm={6}>
                <Dropdown
                  title={T.translate("routeExceptions.list.filters.status")}
                  list={this.statusOptions}
                  handleChange={value =>
                    this.handleFilterChange("statusOption", value)
                  }
                />
              </Col>
              <Col md={6}>
                <SearchBy
                  filters={this.searchFields}
                  onSearch={this.handleSearch}
                  onDropdownChange={filter =>
                    this.handleFilterChange("selectedFilter", filter)
                  }
                />
              </Col>
            </Row>
          </Container>
          <Table responsive striped hover>
            <thead>
              <tr>
                <th>
                  <span
                    className="table-header"
                    onKeyPress={() => {}}
                    role="button"
                    tabIndex={-1}
                    onClick={() => this.handleSortChange("routeId")}
                  >
                    {T.translate("routeExceptions.fields.route")}
                    {this.getIcon("routeId")}
                  </span>
                </th>
                <th>
                  <span
                    className="table-header"
                    onKeyPress={() => {}}
                    role="button"
                    tabIndex={-1}
                    onClick={() => this.handleSortChange("shipmentId")}
                  >
                    {T.translate("routeExceptions.fields.shipment")}
                    {this.getIcon("shipmentId")}
                  </span>
                </th>
                <th>
                  <span
                    className="table-header"
                    onKeyPress={() => {}}
                    role="button"
                    tabIndex={-1}
                    onClick={() => this.handleSortChange("type")}
                  >
                    {T.translate("routeExceptions.fields.type")}
                    {this.getIcon("type")}
                  </span>
                </th>
                <th>
                  <span
                    className="table-header"
                    role="button"
                    tabIndex={-1}
                    onClick={() => this.handleSortChange("active")}
                    onKeyPress={() => this.handleSortChange("active")}
                  >
                    {T.translate("routeExceptions.fields.active")}
                    {this.getIcon("active")}
                  </span>
                </th>
                <th colSpan={2}>
                  <span
                    className="table-header"
                    onKeyPress={() => {}}
                    role="button"
                    tabIndex={-1}
                    onClick={() => this.handleSortChange("createdAt")}
                  >
                    {T.translate("routeExceptions.fields.createdAt")}
                    {this.getIcon("createdAt")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {listItems.map(item => (
                <tr key={item.id}>
                  <td className="align-middle">
                    <span className="list-left">
                      <InitialsAvatar
                        name={getValue(item, "type.name", "-")}
                        color={
                          item.active
                            ? "#e74c3c" // Red
                            : "#ccc" // Gray
                        }
                      />
                    </span>
                    <div className="list-body">
                      {item.route ? (
                        <span>
                          <Link
                            to={{
                              pathname: `/routes/details/${item.routeId}`,
                              state: { from: "routeExceptions" }
                            }}
                          >
                            {T.translate("routeExceptions.fields.routeName", {
                              route: item.routeId
                            })}
                          </Link>
                          <small className="text-muted d-block">
                            {item.route.bundleId
                              ? T.translate(
                                  `routes.fields.bundles.${
                                    this.bundleTypes[item.route.bundleId]
                                  }`
                                )
                              : "--"}
                          </small>
                        </span>
                      ) : (
                        "--"
                      )}
                    </div>
                  </td>
                  <td className="align-middle">
                    {item.shipment ? (
                      <Link
                        to={{
                          pathname: `/shipments/details/${item.shipmentId}`,
                          state: { from: "routeExceptions" }
                        }}
                      >
                        {item.shipment.trackingId}
                      </Link>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="align-middle">
                    {item.type
                      ? T.translate(
                          `routeExceptions.fields.types.${item.type.name}`
                        )
                      : "--"}
                  </td>
                  <td className="align-middle">
                    {T.translate(`defaults.${item.active ? "yes" : "no"}`)}
                  </td>
                  <td className="align-middle">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : "--"}
                  </td>
                  <td className="text-right py-0 align-middle">
                    <div className="btn-group" role="group">
                      <Link
                        to={{
                          pathname: `/${resourceNameOnApi}/details/${item.id}`,
                          state: {
                            modal: true,
                            modalTitle: T.translate(
                              "routeExceptions.detail.title"
                            )
                          }
                        }}
                        className="btn btn-primary btn-sm"
                        title={T.translate("routeExceptions.list.viewTooltip")}
                      >
                        <FontAwesomeIcon icon="eye" fixedWidth />
                      </Link>
                      <Link
                        className="btn btn-primary btn-sm"
                        to={{
                          pathname: `/${resourceNameOnApi}/update/${item.id}`,
                          state: {
                            modal: true,
                            modalTitle: T.translate(
                              "routeExceptions.form.title.update"
                            )
                          }
                        }}
                        title={T.translate("routeExceptions.list.editTooltip")}
                      >
                        <FontAwesomeIcon icon="pencil-alt" fixedWidth />
                      </Link>
                      {hasRoles(ROLE.ADMIN) && (
                        <Button
                          size="sm"
                          color="primary"
                          title={T.translate(
                            "routeExceptions.list.deleteTooltip"
                          )}
                          onClick={() => {
                            this.setState({
                              selectedItemToBeDeleted: item,
                              showDeletionConfirmation: true
                            });
                          }}
                        >
                          <FontAwesomeIcon icon="trash-alt" fixedWidth />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <footer className="p-a dker">
            <Pagination
              ref={this.pagination}
              resourceNameOnApi={resourceNameOnApi}
              filter={{ ...searchParam.filter, order }}
              onItemsReceived={async listItemsReceived => {
                this.setState({
                  listItems: listItemsReceived,
                  backupList: listItemsReceived
                });
              }}
            />
          </footer>
        </div>
      </Container>,
      <SweetAlert
        key="sweet-alert"
        show={showDeletionConfirmation}
        title={T.translate("routeExceptions.list.deleteWarning.title", {
          itemToBeDeleted: selectedItemToBeDeleted
            ? selectedItemToBeDeleted.routeId
            : ""
        })}
        text={T.translate("routeExceptions.list.deleteWarning.message")}
        type="warning"
        showCancelButton
        confirmButtonText={T.translate(
          "routeExceptions.list.deleteWarning.confirmButton"
        )}
        cancelButtonText={T.translate(
          "routeExceptions.list.deleteWarning.cancelButton"
        )}
        confirmButtonClass="btn btn-primary btn-rounded mx-2 btn-lg px-5"
        cancelButtonClass="btn btn-secondary btn-rounded mx-2 btn-lg px-5"
        buttonsStyling={false}
        onConfirm={() => {
          this.delete(selectedItemToBeDeleted.id);
          this.setState({ showDeletionConfirmation: false });
        }}
      />
    ];
  }
}

export default withHeader(RouteExceptionList);
