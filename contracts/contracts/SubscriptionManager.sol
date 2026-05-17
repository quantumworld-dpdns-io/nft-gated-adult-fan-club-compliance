// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SubscriptionManager is Ownable, ReentrancyGuard {
    struct Subscription {
        address subscriber;
        uint256 planId;
        uint256 startTime;
        uint256 endTime;
        bool autoRenew;
        bool active;
    }

    struct Plan {
        string name;
        uint256 price;
        uint256 durationDays;
        bool exists;
    }

    uint256 public constant MONTHLY = 1;
    uint256 public constant QUARTERLY = 2;
    uint256 public constant YEARLY = 3;

    uint256 public constant MONTHLY_PRICE = 0.05 ether;
    uint256 public constant QUARTERLY_PRICE = 0.12 ether;
    uint256 public constant YEARLY_PRICE = 0.40 ether;

    uint256 public constant MONTHLY_DURATION = 30 days;
    uint256 public constant QUARTERLY_DURATION = 90 days;
    uint256 public constant YEARLY_DURATION = 365 days;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) private _subscriptions;
    mapping(address => uint256[]) private _userSubscriptions;

    uint256 private _nextSubscriptionId;
    uint256 private _nextPlanId;

    event Subscribed(
        address indexed subscriber,
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        uint256 startTime,
        uint256 endTime,
        bool autoRenew
    );

    event Cancelled(address indexed subscriber, uint256 indexed subscriptionId);

    event Renewed(
        address indexed subscriber,
        uint256 indexed subscriptionId,
        uint256 newEndTime
    );

    event PlanAdded(uint256 indexed planId, string name, uint256 price, uint256 durationDays);
    event PlanUpdated(uint256 indexed planId, string name, uint256 price, uint256 durationDays);
    event PlanRemoved(uint256 indexed planId);

    constructor() Ownable(msg.sender) {
        _nextPlanId = 1;

        plans[MONTHLY] = Plan("Monthly", MONTHLY_PRICE, MONTHLY_DURATION, true);
        plans[QUARTERLY] = Plan("Quarterly", QUARTERLY_PRICE, QUARTERLY_DURATION, true);
        plans[YEARLY] = Plan("Yearly", YEARLY_PRICE, YEARLY_DURATION, true);

        _nextSubscriptionId = 1;
    }

    function subscribe(uint256 planId, bool autoRenew) external payable nonReentrant returns (uint256) {
        Plan storage plan = plans[planId];
        require(plan.exists, "Plan does not exist");
        require(msg.value >= plan.price, "Insufficient payment");

        uint256 subId = _nextSubscriptionId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + plan.durationDays;

        _subscriptions[subId] = Subscription({
            subscriber: msg.sender,
            planId: planId,
            startTime: startTime,
            endTime: endTime,
            autoRenew: autoRenew,
            active: true
        });

        _userSubscriptions[msg.sender].push(subId);

        emit Subscribed(msg.sender, subId, planId, startTime, endTime, autoRenew);

        uint256 excess = msg.value - plan.price;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }

        return subId;
    }

    function cancelSubscription(uint256 subId) external nonReentrant {
        Subscription storage sub = _subscriptions[subId];
        require(sub.subscriber == msg.sender, "Not subscription owner");
        require(sub.active, "Subscription not active");

        sub.active = false;

        emit Cancelled(msg.sender, subId);
    }

    function renewSubscription(uint256 subId) external payable nonReentrant {
        Subscription storage sub = _subscriptions[subId];
        require(sub.subscriber == msg.sender, "Not subscription owner");
        require(sub.active, "Subscription not active");

        Plan storage plan = plans[sub.planId];
        require(plan.exists, "Plan no longer available");
        require(msg.value >= plan.price, "Insufficient payment");

        uint256 newEndTime;
        if (block.timestamp > sub.endTime) {
            newEndTime = block.timestamp + plan.durationDays;
        } else {
            newEndTime = sub.endTime + plan.durationDays;
        }

        sub.endTime = newEndTime;

        emit Renewed(msg.sender, subId, newEndTime);

        uint256 excess = msg.value - plan.price;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "Refund failed");
        }
    }

    function isSubscriptionActive(address user) external view returns (bool) {
        uint256[] storage userSubs = _userSubscriptions[user];
        for (uint256 i = 0; i < userSubs.length; i++) {
            Subscription storage sub = _subscriptions[userSubs[i]];
            if (sub.active && sub.endTime > block.timestamp) {
                return true;
            }
        }
        return false;
    }

    function getSubscription(uint256 subId) external view returns (Subscription memory) {
        require(_subscriptions[subId].subscriber != address(0), "Subscription does not exist");
        return _subscriptions[subId];
    }

    function getUserSubscriptions(address user) external view returns (uint256[] memory) {
        return _userSubscriptions[user];
    }

    function getUserActiveSubscription(address user) external view returns (uint256) {
        uint256[] storage userSubs = _userSubscriptions[user];
        for (uint256 i = 0; i < userSubs.length; i++) {
            Subscription storage sub = _subscriptions[userSubs[i]];
            if (sub.active && sub.endTime > block.timestamp) {
                return userSubs[i];
            }
        }
        return 0;
    }

    function getSubscriptionEndTime(uint256 subId) external view returns (uint256) {
        require(_subscriptions[subId].subscriber != address(0), "Subscription does not exist");
        return _subscriptions[subId].endTime;
    }

    function setAutoRenew(uint256 subId, bool autoRenew) external {
        Subscription storage sub = _subscriptions[subId];
        require(sub.subscriber == msg.sender, "Not subscription owner");
        require(sub.active, "Subscription not active");
        sub.autoRenew = autoRenew;
    }

    function addPlan(string memory name, uint256 price, uint256 durationDays) external onlyOwner {
        uint256 planId = _nextPlanId++;
        plans[planId] = Plan(name, price, durationDays, true);
        emit PlanAdded(planId, name, price, durationDays);
    }

    function updatePlan(uint256 planId, string memory name, uint256 price, uint256 durationDays) external onlyOwner {
        require(plans[planId].exists, "Plan does not exist");
        plans[planId] = Plan(name, price, durationDays, true);
        emit PlanUpdated(planId, name, price, durationDays);
    }

    function removePlan(uint256 planId) external onlyOwner {
        require(plans[planId].exists, "Plan does not exist");
        require(planId > YEARLY, "Cannot remove default plans");
        delete plans[planId];
        emit PlanRemoved(planId);
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "Withdrawal failed");
    }
}
